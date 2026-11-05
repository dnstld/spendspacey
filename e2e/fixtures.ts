import { test as base, expect } from '@playwright/test';
import { SYNTHETIC_ENV } from '../test/config';
import { syntheticSession } from '../test/session';
import { pagesHeadersFor } from '../test/pagesHeaders';
import { callbackRoute } from '../src/lib/callbackRoute';

interface AuthFixture {
  mode: 'success' | 'cancelled' | 'signup-disabled' | 'exchange-failure';
  exchanges: number;
  brokenAvatar: boolean;
  returnPath: string;
  profileReads: number;
  profileMode: 'success' | 'missing' | 'error' | 'malformed';
  networkAvailable: boolean;
}

export const test = base.extend<{ auth: AuthFixture }>({
  auth: [
    async ({ context, baseURL }, use, testInfo) => {
      const auth: AuthFixture = {
        mode: 'success',
        exchanges: 0,
        brokenAvatar: false,
        returnPath: callbackRoute.path,
        profileReads: 0,
        profileMode: 'success',
        networkAvailable: true,
      };
      const unexpected: string[] = [];
      const errors: string[] = [];
      context.on('page', (page) => {
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.text().startsWith('CSP violation:')) errors.push(message.text());
        });
      });
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error('CSP violation:', event.effectiveDirective);
        });
      });
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === baseURL) {
          if (route.request().resourceType() !== 'document') return route.continue();
          // Enforce the built CSP in Chromium. This does not verify Cloudflare itself.
          const response = await route.fetch();
          return route.fulfill({
            response,
            headers: {
              ...response.headers(),
              ...pagesHeadersFor(String(testInfo.project.metadata.buildDir), url.pathname),
            },
          });
        }
        if (url.origin === SYNTHETIC_ENV.VITE_SUPABASE_URL) {
          if (!auth.networkAvailable) return route.abort('internetdisconnected');
          if (url.pathname === '/auth/v1/authorize') {
            const callback = url.searchParams.get('redirect_to');
            expect(callback).toBe(`${baseURL}${callbackRoute.path}`);
            expect(url.searchParams.get('provider')).toBe('google');
            expect(url.searchParams.get('code_challenge')).toBeTruthy();
            expect(url.searchParams.get('code_challenge_method')).toBe('s256');
            const suffix =
              auth.mode === 'cancelled'
                ? '#error=access_denied'
                : auth.mode === 'signup-disabled'
                  ? '#error=access_denied&error_code=signup_disabled'
                  : '?code=synthetic-code';
            return route.fulfill({
              status: 302,
              headers: { location: `${baseURL}${auth.returnPath}${suffix}` },
            });
          }
          if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
            auth.exchanges++;
            const body: Record<string, string> = route.request().postDataJSON();
            expect(body.auth_code).toBe('synthetic-code');
            expect(body.code_verifier.length).toBeGreaterThanOrEqual(43);
            return auth.mode === 'exchange-failure'
              ? route.fulfill({
                  status: 400,
                  headers: {
                    'x-supabase-api-version': '2024-01-01',
                    'access-control-expose-headers': 'X-Supabase-Api-Version',
                  },
                  json: { code: 'flow_state_expired', message: 'Synthetic code expired' },
                })
              : route.fulfill({ json: syntheticSession() });
          }
          if (url.pathname === '/auth/v1/user')
            return route.fulfill({ json: syntheticSession().user });
          if (url.pathname === '/auth/v1/logout') {
            expect(url.searchParams.get('scope')).toBe('local');
            return route.fulfill({ status: 204 });
          }
          if (url.pathname === '/rest/v1/profiles') {
            expect(route.request().method()).toBe('GET');
            expect(url.searchParams.get('select')).toBe('id,display_name,avatar_url,updated_at');
            expect(url.searchParams.get('id')).toBe(`eq.${syntheticSession().user.id}`);
            auth.profileReads++;
            if (auth.profileMode === 'error')
              return route.fulfill({
                status: 500,
                json: { code: 'XX000', message: 'synthetic private diagnostic' },
              });
            if (auth.profileMode === 'missing') return route.fulfill({ json: [] });
            return route.fulfill({
              json: [
                {
                  id: syntheticSession().user.id,
                  display_name: 'Test Person',
                  avatar_url:
                    auth.profileMode === 'malformed'
                      ? { unsafe: true }
                      : 'https://images.example.test/profile.png',
                  updated_at: '2026-10-30T12:00:00Z',
                },
              ],
            });
          }
        }
        if (
          url.href === 'https://images.example.test/avatar.png' ||
          url.href === 'https://images.example.test/profile.png'
        ) {
          return auth.brokenAvatar
            ? route.fulfill({ status: 404 })
            : route.fulfill({
                contentType: 'image/svg+xml',
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#e8eee7"/><text x="40" y="48" text-anchor="middle" font-size="24" fill="#184d3f">TP</text></svg>',
              });
        }
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort();
      });
      await use(auth);
      expect(unexpected, 'Unexpected network requests').toEqual([]);
      expect(errors, 'Uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
