import { describe, expect, it } from 'vitest';
import { routeRequest, validStaticResponse } from '../../worker/policy';
const origin = 'https://app.example.test';
const approved = new Set([`${origin}/`, `${origin}/assets/index-abcdefgh.js`]);
function request(path: string, init?: RequestInit, navigation = false) {
  const result = new Request(new URL(path, origin), init);
  if (navigation) Object.defineProperty(result, 'mode', { value: 'navigate' });
  return result;
}
describe('static worker request boundary', () => {
  it.each([
    ['/assets/index-abcdefgh.js', false, 'static'],
    ['/index.html', false, 'network'],
    ['/', true, 'shell'],
    ['/auth/callback?code=private#token=private', true, 'callback'],
    ['/auth/callback', false, 'network'],
    ['/?code=private', true, 'network'],
    ['/assets/index-abcdefgh.js?token=private', false, 'network'],
    ['/assets/unknown-abcdefgh.js', false, 'network'],
    ['/assets/index-abcdefgh', false, 'network'],
    ['/api/profiles', false, 'network'],
    ['/auth/v1/token', false, 'network'],
    ['/rest/v1/profiles', false, 'network'],
    ['/oauth/authorize', true, 'network'],
    ['https://auth.example.test/auth/v1/token', false, 'network'],
    ['https://accounts.google.com/o/oauth2/v2/auth', true, 'network'],
    ['https://images.example.test/avatar.png', false, 'network'],
  ])('%s -> %s', (path, navigation, expected) => {
    expect(routeRequest(request(path, undefined, navigation), origin, approved)).toBe(expected);
  });
  it.each(['/', '/auth/callback?code=private', '/assets/index-abcdefgh.js'])(
    'bypasses authorized and non-GET %s',
    (path) => {
      expect(
        routeRequest(
          request(path, { headers: { authorization: 'Bearer private' } }, true),
          origin,
          approved,
        ),
      ).toBe('network');
      expect(
        routeRequest(request(path, { method: 'POST', body: 'private' }), origin, approved),
      ).toBe('network');
    },
  );
  it('rejects fallback HTML, redirects and invalid MIME as scripts', () => {
    expect(
      validStaticResponse(
        '/assets/index-abcdefgh.js',
        new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
      ),
    ).toBe(false);
    expect(
      validStaticResponse(
        '/assets/index-abcdefgh.js',
        new Response('code', { headers: { 'content-type': 'application/javascript' } }),
      ),
    ).toBe(true);
    expect(
      validStaticResponse(
        '/sw.js',
        new Response('code', {
          status: 404,
          headers: { 'content-type': 'application/javascript' },
        }),
      ),
    ).toBe(false);
  });
});
