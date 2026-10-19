import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthContext, type AuthState } from './context';
import { authMessage, requireAuthStorage, type AuthMessage } from './errors';
import { authenticationAllowed } from '@/lib/deployment';
import { callbackRoute } from '@/lib/callbackRoute';

export function AuthProvider({
  client,
  children,
}: {
  client: SupabaseClient;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>(() => ({
    status: authenticationAllowed() ? 'initializing' : 'ready',
    session: null,
  }));
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [pending, setPending] = useState<'signIn' | 'signOut' | null>(null);
  const operation = useRef(false);

  useEffect(() => {
    if (!authenticationAllowed()) return;
    let active = true;
    let revision = 0;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active || event === 'INITIAL_SESSION') return;
      // The explicit read owns INITIAL_SESSION; only newer changes supersede it.
      revision++;
      setState({ status: 'ready', session });
      setMessage(null);
    });
    const readRevision = revision;
    let settled = false;
    const unavailable = () => {
      if (!active || settled || revision !== readRevision) return;
      setState((previous) =>
        previous.status === 'initializing' ? { ...previous, status: 'error' } : previous,
      );
      setMessage('offlineRestore');
    };
    const timer = window.setTimeout(unavailable, 8000);
    window.addEventListener('offline', unavailable);
    if (navigator.onLine === false) unavailable();
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || revision !== readRevision) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          setState((previous) => ({ ...previous, status: 'error' }));
          setMessage(navigator.onLine === false ? 'offlineRestore' : authMessage(error, 'restore'));
        } else {
          setState({ status: 'ready', session: data.session });
          setMessage(null);
        }
      })
      .catch(() => {
        if (!active || revision !== readRevision) return;
        settled = true;
        setState((previous) => ({ ...previous, status: 'error' }));
        clearTimeout(timer);
        setMessage(navigator.onLine === false ? 'offlineRestore' : 'restore');
      });
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('offline', unavailable);
      subscription.unsubscribe();
    };
  }, [client, attempt]);

  function retry() {
    if (!authenticationAllowed()) return;
    setMessage(null);
    setState((previous) => ({ ...previous, status: 'initializing' }));
    setAttempt((previous) => previous + 1);
  }

  async function signIn(tryConnection = false) {
    if (!authenticationAllowed()) {
      setMessage('previewAuthentication');
      return;
    }
    if (operation.current) return;
    if (navigator.onLine === false && !tryConnection) {
      setMessage('offlineSignIn');
      return;
    }
    operation.current = true;
    setPending('signIn');
    setMessage(null);
    try {
      requireAuthStorage();
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${callbackRoute.path}`,
          scopes: 'openid email profile',
        },
      });
      if (error) throw error;
      // Full-page navigation owns success; keep the action disabled until unload.
    } catch (error) {
      setMessage(authMessage(error, 'signIn'));
      setPending(null);
      operation.current = false;
    }
  }

  async function signOut(tryConnection = false) {
    if (!authenticationAllowed()) {
      setMessage('previewAuthentication');
      return;
    }
    if (operation.current) return;
    if (navigator.onLine === false && !tryConnection) {
      setMessage('offlineSignOut');
      return;
    }
    operation.current = true;
    setPending('signOut');
    setMessage(null);
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      // Session changes come from the SDK subscription, including other tabs.
    } catch (error) {
      setMessage(authMessage(error, 'signOut'));
    } finally {
      setPending(null);
      operation.current = false;
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, client, message, pending, retry, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
