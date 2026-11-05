import { vi } from 'vitest';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { syntheticSession } from './session';

export function authMock() {
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
  const subscriptions = new Set<ReturnType<typeof vi.fn>>();
  const user = syntheticSession().user;
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn(
      (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        listeners.add(callback);
        const unsubscribe = vi.fn(() => listeners.delete(callback));
        subscriptions.add(unsubscribe);
        return { data: { subscription: { unsubscribe } } };
      },
    ),
    signInWithOAuth: vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://auth.example.test/authorize' },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: user.id,
      display_name: 'Test Person',
      avatar_url: 'https://images.example.test/profile.png',
      updated_at: '2026-10-30T12:00:00Z',
    },
    error: null,
  });
  const retry = vi.fn(() => ({ maybeSingle }));
  const abortSignal = vi.fn((signal: AbortSignal) => {
    void signal;
    return { retry };
  });
  const eq = vi.fn(() => ({ abortSignal, retry }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { auth, from } as unknown as SupabaseClient,
    auth,
    profile: { from, select, eq, abortSignal, retry, maybeSingle },
    subscriptions,
    listeners,
    emit: (event: AuthChangeEvent, session: Session | null) => {
      for (const callback of listeners) callback(event, session);
    },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
