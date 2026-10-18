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
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || revision !== readRevision) return;
        if (error) {
          setState((previous) => ({ ...previous, status: 'error' }));
          setMessage(authMessage(error, 'restore'));
        } else {
          setState({ status: 'ready', session: data.session });
        }
      })
      .catch(() => {
        if (!active || revision !== readRevision) return;
        setState((previous) => ({ ...previous, status: 'error' }));
        setMessage('restore');
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, attempt]);

  function retry() {
    if (!authenticationAllowed()) return;
    setMessage(null);
    setState((previous) => ({ ...previous, status: 'initializing' }));
    setAttempt((previous) => previous + 1);
  }

  async function signIn() {
    if (!authenticationAllowed()) {
      setMessage('previewAuthentication');
      return;
    }
    if (operation.current) return;
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

  async function signOut() {
    if (!authenticationAllowed()) {
      setMessage('previewAuthentication');
      return;
    }
    if (operation.current) return;
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
