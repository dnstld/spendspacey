import type { SupabaseClient } from '@supabase/supabase-js';

export const currentProfileProjection = 'id,display_name,avatar_url,updated_at' as const;

export interface CurrentProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

export class ProfileReadError extends Error {
  constructor() {
    super('Current-user profile is unavailable');
    this.name = 'ProfileReadError';
  }
}

function safeAvatarUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function parseCurrentProfile(value: unknown, ownerId: string): CurrentProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProfileReadError();
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (keys.join(',') !== 'avatar_url,display_name,id,updated_at') throw new ProfileReadError();
  if (row.id !== ownerId) throw new ProfileReadError();
  if (row.display_name !== null && typeof row.display_name !== 'string')
    throw new ProfileReadError();
  if (row.avatar_url !== null && typeof row.avatar_url !== 'string') throw new ProfileReadError();
  if (typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at)))
    throw new ProfileReadError();

  return {
    id: ownerId,
    displayName: row.display_name,
    avatarUrl: row.avatar_url === null ? null : safeAvatarUrl(row.avatar_url),
    updatedAt: row.updated_at,
  };
}

export async function readCurrentProfile(
  client: SupabaseClient,
  sessionUserId: string,
  signal?: AbortSignal,
): Promise<CurrentProfile | null> {
  let verifiedId: string;
  try {
    if (signal?.aborted) throw new ProfileReadError();
    const { data, error } = await client.auth.getUser();
    if (signal?.aborted) throw new ProfileReadError();
    if (error || !data.user || data.user.id !== sessionUserId) throw new ProfileReadError();
    verifiedId = data.user.id;
  } catch {
    throw new ProfileReadError();
  }

  try {
    let query = client.from('profiles').select(currentProfileProjection).eq('id', verifiedId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.retry(false).maybeSingle();
    if (signal?.aborted) throw new ProfileReadError();
    if (error) throw new ProfileReadError();
    return data === null ? null : parseCurrentProfile(data, verifiedId);
  } catch {
    throw new ProfileReadError();
  }
}
