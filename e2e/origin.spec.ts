import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type BrowserContext } from '@playwright/test';
import { SYNTHETIC_ENV } from '../test/config';
import { syntheticSession } from '../test/session';
import { pagesHeadersFor } from '../test/pagesHeaders';
import { callbackRoute } from '../src/lib/callbackRoute';
import { callbackInputs, callbackPaths, unrelatedPaths } from '../test/callbackPaths';

const canonical = 'https://synthetic-app.pages.dev';
const productionDir = '.cache/deploy-auth-shell/production';
// Read the production bytes once: every origin below receives this exact artifact.
function inventory(dir: string) {
  return new Map(
    readdirSync(dir, { recursive: true })
      .map(String)
      .filter((path) => /\.(html|js|css|png|woff2)$/.test(path))
      .map((path) => [path, readFileSync(resolve(dir, path))]),
  );
}
const production = inventory(productionDir);
const mime: Record<string, string> = {
  html: 'text/html',
  js: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  woff2: 'font/woff2',
};

async function serveArtifact(context: BrowserContext, origin: string, kind = 'production') {
  const dir = `.cache/deploy-auth-shell/${kind}`;
  const files = kind === 'production' ? production : inventory(dir);
  const authRequests: string[] = [];
  const sdkRequests: string[] = [];
  const unexpected: string[] = [];
  let exchanges = 0;
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      const path = url.pathname.slice(1);
      const file = files.has(path) ? path : 'index.html'; // native SPA fallback contract
      if (/^assets\/supabase-/.test(path)) sdkRequests.push(path);
      return route.fulfill({
        body: files.get(file),
        headers: {
          ...pagesHeadersFor(dir, url.href),
          'content-type': mime[file.split('.').at(-1)!],
        },
      });
    }
    if (url.origin === SYNTHETIC_ENV.VITE_SUPABASE_URL) {
      authRequests.push(url.pathname);
      if (url.pathname === '/auth/v1/authorize') {
        expect(url.searchParams.get('redirect_to')).toBe(`${canonical}/auth/callback`);
        expect(url.searchParams.get('code_challenge_method')).toBe('s256');
        return route.fulfill({
          // Playwright doesn't re-route subsequent requests in an HTTP redirect
          // chain. A new provider navigation keeps these synthetic HTTPS origins
          // entirely local; the localhost suite also covers real 302 responses.
          contentType: 'text/html',
          body: `<meta http-equiv="refresh" content="0;url=${canonical}/auth/callback?code=synthetic-code">`,
        });
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
        const data = route.request().postDataJSON();
        expect(data.auth_code).toBe('synthetic-code');
        expect(data.code_verifier.length).toBeGreaterThanOrEqual(43);
        exchanges++;
        return route.fulfill({ json: syntheticSession() });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: syntheticSession().user });
    }
    if (url.href === 'https://images.example.test/avatar.png')
      return route.fulfill({ status: 404 });
    unexpected.push(url.origin + url.pathname);
    await route.abort();
  });
  return { authRequests, sdkRequests, unexpected, exchanges: () => exchanges };
}

test('the production artifact authenticates, restores and signs out only on its canonical origin', async ({
  context,
  page,
}) => {
  const calls = await serveArtifact(context, canonical);
  await page.goto(canonical);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await expect(page).toHaveURL(`${canonical}/`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  expect(calls.exchanges()).toBe(1);
  expect(calls.sdkRequests.length).toBeGreaterThan(0);
  expect(calls.unexpected).toEqual([]);
});

for (const [kind, origin] of [
  ['production', 'https://deadbeef.synthetic-app.pages.dev'],
  ['production', 'https://unrelated.example.test'],
  ['production', 'http://127.0.0.1:4173'],
  ['production', 'http://localhost:5173'],
  ['preview', canonical],
  ['unclassified', canonical],
]) {
  test(`${kind} at ${origin} constructs no Auth client, restores no session and exchanges no callback`, async ({
    context,
    page,
  }) => {
    const calls = await serveArtifact(context, origin, kind);
    // An expired saved session would trigger refresh if an Auth client existed.
    await context.addInitScript(
      (session) => {
        localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
        localStorage.setItem('sb-auth-auth-token-code-verifier', 'synthetic-verifier');
        const state = {
          idx: 0,
          key: 'synthetic-entry',
          usr: { sentinel: 'preserve current entry' },
        };
        history.replaceState(state, '');
        sessionStorage.setItem(
          'synthetic-history-before-bootstrap',
          JSON.stringify({ state, length: history.length }),
        );
      },
      { ...syntheticSession(), expires_at: 1 },
    );
    await page.goto(origin);
    await expect(page.getByRole('alert')).toContainText('unavailable at this address');
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
    for (const path of callbackPaths) {
      for (const input of callbackInputs) {
        // Start from another path so a fragment-only case is a fresh callback
        // document launch, rather than a same-document hash navigation.
        await page.goto(origin);
        await page.goto(`${origin}${path}${input}`);
        await expect(page).toHaveURL(`${origin}${callbackRoute.path}`);
        await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
        const entry = await page.evaluate(() => ({
          actual: { state: history.state, length: history.length },
          before: JSON.parse(sessionStorage.getItem('synthetic-history-before-bootstrap')!),
        }));
        expect(entry.actual).toEqual(entry.before);
      }
    }
    for (const path of unrelatedPaths) {
      const url = `${origin}${path}?code=synthetic-unrelated#error=synthetic-unrelated`;
      await page.goto(url);
      await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
      expect(page.url()).toBe(url);
    }
    await page.getByRole('combobox').selectOption('pt-BR');
    await expect(page.getByRole('alert')).toContainText('indisponível neste endereço');
    expect(calls.authRequests).toEqual([]);
    // All SDK construction lives in this lazy module; denied launches never load it.
    // Unit tests also spy on createClient directly, including invalid configuration.
    expect(calls.sdkRequests).toEqual([]);
    expect(calls.exchanges()).toBe(0);
    expect(calls.unexpected).toEqual([]);
  });
}
