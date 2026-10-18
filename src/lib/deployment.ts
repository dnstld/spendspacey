export type AuthenticationPolicy =
  { kind: 'production'; origin: string } | { kind: 'local' } | { kind: 'denied' };

export function authenticationAllowed(
  origin = window.location.origin,
  policy: AuthenticationPolicy = __AUTH_POLICY__,
): boolean {
  if (policy.kind === 'production') return origin === policy.origin;
  if (policy.kind === 'local') {
    return ['http://localhost:5173', 'http://127.0.0.1:4173'].includes(origin);
  }
  return false;
}

export function scrubUnavailableCallback() {
  if (window.location.pathname === '/auth/callback') {
    window.history.replaceState(window.history.state, '', '/auth/callback');
  }
}
