import { callbackRoute } from '../src/lib/callbackRoute';

// Concrete regression inputs, not an alternate implementation of route matching.
export const callbackPaths = [
  callbackRoute.path,
  `${callbackRoute.path}/`,
  callbackRoute.path.toUpperCase(),
  `${callbackRoute.path.toUpperCase()}///`,
  '/auth/%63allback',
  '/%61uth/callback',
];

export const unrelatedPaths = [
  '/',
  '/elsewhere',
  `${callbackRoute.path}-extra`,
  `${callbackRoute.path}/child`,
  '/auth%2Fcallback',
  '/auth/%2563allback',
];

export const callbackInputs = [
  '?code=synthetic-code',
  '#error=access_denied',
  '?code=synthetic-code#error=access_denied',
];
