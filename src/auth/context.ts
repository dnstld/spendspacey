import { createContext, useContext } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthMessage } from './errors';

export interface AuthState {
  status: 'initializing' | 'ready' | 'error';
  session: Session | null;
}

export interface AuthContextValue extends AuthState {
  client: SupabaseClient;
  pending: 'signIn' | 'signOut' | null;
  message: AuthMessage | null;
  retry: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Authentication provider is required');
  return value;
}
