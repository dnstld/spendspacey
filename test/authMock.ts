import { vi } from 'vitest';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';

export function authMock() {
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
  const subscriptions = new Set<ReturnType<typeof vi.fn>>();
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
  };
  return {
    client: { auth } as unknown as SupabaseClient,
    auth,
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
