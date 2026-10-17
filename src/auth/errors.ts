import type { en } from '@/i18n/en';

export type AuthMessage = keyof typeof en.errors;

export class AuthStorageError extends Error {}

export function requireAuthStorage() {
  try {
    const key = 'spendspacey.auth-storage-probe';
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
  } catch {
    throw new AuthStorageError();
  }
}

export function authMessage(error: unknown, fallback: AuthMessage): AuthMessage {
  if (error instanceof AuthStorageError) return 'storage';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'signup_disabled' || code === 'signup_not_allowed') return 'signupDisabled';
  if (code === 'access_denied') return 'cancelled';
  if (
    ['flow_state_not_found', 'flow_state_expired', 'bad_code_verifier', 'bad_oauth_state'].includes(
      String(code),
    )
  )
    return 'invalidCallback';
  return fallback;
}
