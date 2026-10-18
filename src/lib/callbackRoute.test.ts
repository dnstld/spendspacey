import { matchRoutes } from 'react-router';
import { expect, it } from 'vitest';
import { callbackRoute, isCallbackPath } from './callbackRoute';
import { callbackPaths, unrelatedPaths } from '../../test/callbackPaths';

it.each(callbackPaths)('recognizes the shared callback route at %s', (pathname) => {
  expect(matchRoutes([callbackRoute], { pathname })?.at(-1)?.route).toBe(callbackRoute);
  expect(isCallbackPath(pathname)).toBe(true);
});

it.each(unrelatedPaths)('does not recognize unrelated/near-match path %s', (pathname) => {
  expect(matchRoutes([callbackRoute], { pathname })).toBeNull();
  expect(isCallbackPath(pathname)).toBe(false);
});
