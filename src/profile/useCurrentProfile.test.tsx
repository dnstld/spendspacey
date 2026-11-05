import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { authMock, deferred } from '../../test/authMock';
import { syntheticSession } from '../../test/session';
import { currentProfileReadDeadlineMs, useCurrentProfile } from './useCurrentProfile';

const ownerA = syntheticSession().user.id;
const ownerB = '00000000-0000-4000-8000-000000000002';

function row(id: string, name: string) {
  return {
    id,
    display_name: name,
    avatar_url: null,
    updated_at: '2026-10-30T12:00:00Z',
  };
}

function Probe({
  client,
  ownerId,
  generation,
  enabled = true,
}: {
  client: SupabaseClient;
  ownerId: string | null;
  generation: number;
  enabled?: boolean;
}) {
  const { state, retry } = useCurrentProfile({ client, ownerId, generation, enabled });
  return (
    <>
      <output>
        {state.status}:{state.profile?.displayName ?? 'none'}
      </output>
      <button onClick={retry}>retry</button>
    </>
  );
}

describe('current profile lifecycle', () => {
  it('coalesces Strict Mode and repeated-event reads for one account generation', async () => {
    const mock = authMock();
    const identity = deferred<Awaited<ReturnType<typeof mock.auth.getUser>>>();
    mock.auth.getUser.mockReturnValue(identity.promise);
    render(
      <StrictMode>
        <Probe client={mock.client} ownerId={ownerA} generation={1} />
      </StrictMode>,
    );
    await waitFor(() => expect(mock.auth.getUser).toHaveBeenCalledOnce());
    act(() => {
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mock.auth.getUser).toHaveBeenCalledOnce();
    await act(async () =>
      identity.resolve({ data: { user: syntheticSession().user }, error: null }),
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:Test Person'));
    expect(mock.profile.from).toHaveBeenCalledOnce();
    expect(mock.profile.abortSignal).toHaveBeenCalledOnce();
    expect(mock.profile.abortSignal.mock.calls[0]?.[0]).toMatchObject({ aborted: false });
  });

  it('times out identity verification that never settles and allows a fresh manual retry', async () => {
    vi.useFakeTimers();
    const mock = authMock();
    mock.auth.getUser.mockReturnValueOnce(new Promise(() => undefined));
    const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);

    try {
      expect(screen.getByRole('status')).toHaveTextContent('loading:none');
      expect(mock.auth.getUser).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(currentProfileReadDeadlineMs);
      });
      expect(screen.getByRole('status')).toHaveTextContent('error:none');

      act(() => screen.getByRole('button', { name: 'retry' }).click());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByRole('status')).toHaveTextContent('ready:Test Person');
      expect(mock.auth.getUser).toHaveBeenCalledTimes(2);
      expect(mock.profile.from).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it.each(['resolves', 'rejects'] as const)(
    'ignores identity verification that %s after expiry and a successful fresh retry',
    async (outcome) => {
      vi.useFakeTimers();
      const mock = authMock();
      const expiredIdentity = deferred<Awaited<ReturnType<typeof mock.auth.getUser>>>();
      const unhandled = vi.fn((event: PromiseRejectionEvent) => event.preventDefault());
      window.addEventListener('unhandledrejection', unhandled);
      mock.auth.getUser.mockReturnValueOnce(expiredIdentity.promise);
      mock.profile.maybeSingle.mockResolvedValueOnce({
        data: row(ownerA, 'Fresh Person'),
        error: null,
      });
      const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);

      try {
        expect(screen.getByRole('status')).toHaveTextContent('loading:none');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(currentProfileReadDeadlineMs);
        });
        expect(screen.getByRole('status')).toHaveTextContent('error:none');
        expect(mock.profile.from).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);

        act(() => screen.getByRole('button', { name: 'retry' }).click());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(screen.getByRole('status')).toHaveTextContent('ready:Fresh Person');
        expect(mock.auth.getUser).toHaveBeenCalledTimes(2);
        expect(mock.profile.from).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);

        await act(async () => {
          if (outcome === 'resolves') {
            expiredIdentity.resolve({ data: { user: syntheticSession().user }, error: null });
          } else {
            expiredIdentity.reject(new Error('late private identity diagnostic'));
          }
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(screen.getByRole('status')).toHaveTextContent('ready:Fresh Person');
        expect(mock.profile.from).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener('unhandledrejection', unhandled);
        view.unmount();
        vi.useRealTimers();
      }
    },
  );

  it.each([
    ['foreground', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['reconnect', () => window.dispatchEvent(new Event('online'))],
  ])('starts a fresh %s read after expiry and ignores the late result', async (_name, trigger) => {
    vi.useFakeTimers();
    const mock = authMock();
    const expiredRead = deferred<Awaited<ReturnType<typeof mock.profile.maybeSingle>>>();
    mock.profile.maybeSingle
      .mockReturnValueOnce(expiredRead.promise)
      .mockResolvedValueOnce({ data: row(ownerA, 'Fresh Person'), error: null });
    const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);

    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mock.profile.maybeSingle).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(currentProfileReadDeadlineMs);
      });
      expect(screen.getByRole('status')).toHaveTextContent('error:none');

      act(() => {
        trigger();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByRole('status')).toHaveTextContent('ready:Fresh Person');
      expect(mock.auth.getUser).toHaveBeenCalledTimes(2);
      expect(mock.profile.maybeSingle).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);

      await act(async () =>
        expiredRead.resolve({ data: row(ownerA, 'Expired Person'), error: null }),
      );
      expect(screen.getByRole('status')).toHaveTextContent('ready:Fresh Person');
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it('cancels the transport and deadline when the final subscriber unmounts', async () => {
    vi.useFakeTimers();
    const mock = authMock();
    mock.profile.maybeSingle.mockReturnValueOnce(new Promise(() => undefined));
    const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);

    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const signal = mock.profile.abortSignal.mock.calls[0]?.[0] as AbortSignal;
      expect(signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(1);
      view.unmount();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears immediately on account changes and ignores the older result', async () => {
    const mock = authMock();
    const oldRead = deferred<Awaited<ReturnType<typeof mock.profile.maybeSingle>>>();
    mock.auth.getUser
      .mockResolvedValueOnce({ data: { user: syntheticSession().user }, error: null })
      .mockResolvedValueOnce({
        data: { user: { ...syntheticSession().user, id: ownerB } },
        error: null,
      });
    mock.profile.maybeSingle
      .mockReturnValueOnce(oldRead.promise)
      .mockResolvedValueOnce({ data: row(ownerB, 'Person B'), error: null });
    const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);
    await waitFor(() => expect(mock.profile.maybeSingle).toHaveBeenCalledOnce());
    const oldSignal = mock.profile.abortSignal.mock.calls[0]?.[0];
    view.rerender(<Probe client={mock.client} ownerId={ownerB} generation={2} />);
    expect(screen.getByRole('status')).toHaveTextContent('loading:none');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:Person B'));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => oldRead.resolve({ data: row(ownerA, 'Person A'), error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('ready:Person B');
  });

  it('clears private state when disabled and does not restore a late result', async () => {
    const mock = authMock();
    const read = deferred<Awaited<ReturnType<typeof mock.profile.maybeSingle>>>();
    mock.profile.maybeSingle.mockReturnValue(read.promise);
    const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);
    await waitFor(() => expect(mock.profile.maybeSingle).toHaveBeenCalledOnce());
    const signal = mock.profile.abortSignal.mock.calls[0]?.[0];
    view.rerender(<Probe client={mock.client} ownerId={ownerA} generation={2} enabled={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('idle:none');
    await act(async () => Promise.resolve());
    expect(signal?.aborted).toBe(true);
    await act(async () => read.resolve({ data: row(ownerA, 'Person A'), error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('idle:none');
  });

  it('removes a loaded profile internally while disabled and starts a clean fresh read', async () => {
    const mock = authMock();
    const freshRead = deferred<Awaited<ReturnType<typeof mock.profile.maybeSingle>>>();
    const view = render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:Test Person'));

    view.rerender(<Probe client={mock.client} ownerId={ownerA} generation={1} enabled={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('idle:none');

    mock.profile.maybeSingle.mockReturnValueOnce(freshRead.promise);
    view.rerender(<Probe client={mock.client} ownerId={ownerA} generation={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('loading:none');
    await waitFor(() => expect(mock.profile.maybeSingle).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status')).toHaveTextContent('loading:none');

    await act(async () => freshRead.resolve({ data: row(ownerA, 'Fresh Person'), error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('ready:Fresh Person');
  });

  it('retains an in-page row as stale offline and refreshes it after reconnect', async () => {
    const mock = authMock();
    render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:Test Person'));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('stale:Test Person');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    mock.profile.maybeSingle.mockResolvedValueOnce({
      data: row(ownerA, 'Refreshed Person'),
      error: null,
    });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('ready:Refreshed Person'),
    );
  });

  it('clears a previously displayed row when renewed SDK verification is rejected', async () => {
    const mock = authMock();
    render(<Probe client={mock.client} ownerId={ownerA} generation={1} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:Test Person'));
    mock.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'private rejection diagnostic' },
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('error:none'));
    expect(document.body).not.toHaveTextContent('private rejection diagnostic');
  });
});
