import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { ProfileReadError, currentProfileProjection, readCurrentProfile } from './currentProfile';

const ownerId = '00000000-0000-4000-8000-000000000001';
const row = {
  id: ownerId,
  display_name: 'Database Person',
  avatar_url: 'https://images.example.test/profile.png',
  updated_at: '2026-10-30T12:00:00Z',
};

function profileClient(
  result: unknown = { data: row, error: null },
  verifiedId: string | null = ownerId,
) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const retry = vi.fn(() => ({ maybeSingle }));
  const abortSignal = vi.fn((signal: AbortSignal) => {
    void signal;
    return { retry };
  });
  const eq = vi.fn(() => ({ abortSignal, retry }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn().mockResolvedValue({
    data: { user: verifiedId === null ? null : { id: verifiedId } },
    error: null,
  });
  return {
    client: { auth: { getUser }, from } as unknown as SupabaseClient,
    getUser,
    from,
    select,
    eq,
    abortSignal,
    retry,
    maybeSingle,
  };
}

describe('current-user profile read', () => {
  it('verifies SDK identity and requests only the projected, owner-filtered, uncached row', async () => {
    const mock = profileClient();
    await expect(readCurrentProfile(mock.client, ownerId)).resolves.toEqual({
      id: ownerId,
      displayName: 'Database Person',
      avatarUrl: 'https://images.example.test/profile.png',
      updatedAt: '2026-10-30T12:00:00Z',
    });
    expect(mock.getUser).toHaveBeenCalledOnce();
    expect(mock.from).toHaveBeenCalledWith('profiles');
    expect(mock.select).toHaveBeenCalledWith(currentProfileProjection);
    expect(mock.eq).toHaveBeenCalledWith('id', ownerId);
    expect(mock.retry).toHaveBeenCalledWith(false);
    expect(mock.maybeSingle).toHaveBeenCalledOnce();
  });

  it('accepts a missing row without creating or substituting data', async () => {
    const mock = profileClient({ data: null, error: null });
    await expect(readCurrentProfile(mock.client, ownerId)).resolves.toBeNull();
    expect(mock.from).toHaveBeenCalledOnce();
  });

  it('passes cancellation to the profile transport', async () => {
    const mock = profileClient();
    const controller = new AbortController();
    await expect(
      readCurrentProfile(mock.client, ownerId, controller.signal),
    ).resolves.toMatchObject({
      id: ownerId,
    });
    expect(mock.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it('does not start a profile query when identity verification already expired', async () => {
    const mock = profileClient();
    const controller = new AbortController();
    controller.abort();
    await expect(readCurrentProfile(mock.client, ownerId, controller.signal)).rejects.toEqual(
      new ProfileReadError(),
    );
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong owner', { ...row, id: '00000000-0000-4000-8000-000000000002' }],
    ['multiple rows', [row, row]],
    ['missing selected field', { ...row, updated_at: undefined }],
    ['malformed display name', { ...row, display_name: 7 }],
    ['malformed avatar', { ...row, avatar_url: { href: row.avatar_url } }],
    ['malformed timestamp', { ...row, updated_at: 'not-a-timestamp' }],
    ['unexpected field', { ...row, private_value: 'must-not-enter-the-app' }],
  ])('rejects a %s response', async (_name, data) => {
    await expect(
      readCurrentProfile(profileClient({ data, error: null }).client, ownerId),
    ).rejects.toBeInstanceOf(ProfileReadError);
  });

  it('uses an accessible avatar fallback for unsafe credential-bearing URLs', async () => {
    const mock = profileClient({
      data: { ...row, avatar_url: 'https://user:secret@images.example.test/profile.png' },
      error: null,
    });
    await expect(readCurrentProfile(mock.client, ownerId)).resolves.toMatchObject({
      avatarUrl: null,
    });
  });

  it.each([
    ['verified owner mismatch', profileClient(undefined, '00000000-0000-4000-8000-000000000002')],
    ['missing verified user', profileClient(undefined, null)],
    ['query error', profileClient({ data: null, error: { message: 'private diagnostic' } })],
  ])('rejects %s without exposing diagnostics', async (_name, mock) => {
    await expect(readCurrentProfile(mock.client, ownerId)).rejects.toEqual(new ProfileReadError());
  });

  it('normalizes rejected identity and network operations', async () => {
    const identity = profileClient();
    identity.getUser.mockRejectedValueOnce(new Error('private identity diagnostic'));
    await expect(readCurrentProfile(identity.client, ownerId)).rejects.toEqual(
      new ProfileReadError(),
    );

    const network = profileClient();
    network.maybeSingle.mockRejectedValueOnce(new Error('private network diagnostic'));
    await expect(readCurrentProfile(network.client, ownerId)).rejects.toEqual(
      new ProfileReadError(),
    );
  });
});
