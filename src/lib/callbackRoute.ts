import { matchRoutes } from 'react-router';

export const callbackRoute = { path: '/auth/callback', caseSensitive: false } as const;

export function isCallbackPath(pathname: string): boolean {
  return matchRoutes([callbackRoute], { pathname }) !== null;
}

export function scrubCallbackUrl() {
  if (isCallbackPath(window.location.pathname)) {
    window.history.replaceState(window.history.state, '', callbackRoute.path);
  }
}
