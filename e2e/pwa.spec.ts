import { test, expect, type Page, type BrowserContext, type CDPSession } from '@playwright/test';
import { pwaServer } from './pwa-server';
import { syntheticSession } from '../test/session';
import { SYNTHETIC_ENV } from '../test/config';

// Use the already approved local Auth origin, without broadening origin policy.
test.describe.configure({ mode: 'default' });

const sessions = new WeakMap<Page, CDPSession>();
async function disableHttpCache(page: Page, offline = false) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.clearBrowserCache');
  sessions.set(page, cdp);
  await cdp.send('Network.overrideNetworkState', {
    offline,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  return cdp;
}
async function setOffline(context: BrowserContext, offline: boolean) {
  await context.setOffline(offline);
  // Chromium's network failure emulation and navigator state are separate CDP
  // controls. Cover both, including new targets with an additional cache session.
  for (const page of context.pages()) {
    const cdp = sessions.get(page) ?? (await disableHttpCache(page, offline));
    await cdp.send('Network.overrideNetworkState', {
      offline,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
}
async function prepared(page: Page, origin: string) {
  await disableHttpCache(page);
  await page.goto(origin);
  await expect(page.getByTestId('offline-readiness')).toContainText('ready for offline', {
    timeout: 20_000,
  });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}
async function inventory(page: Page) {
  return page.evaluate(async () => {
    const result = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = (await cache.match(request))!;
        result.push({
          name,
          url: request.url,
          body:
            response.headers.get('content-type')?.includes('image/') ||
            request.url.includes('.woff2')
              ? ''
              : await response.text(),
        });
      }
    }
    return result;
  });
}

for (const locale of ['en', 'pt-BR'])
  test(`prepared offline hard reload and new page: ${locale}`, async ({ page, context }) => {
    const host = await pwaServer();
    try {
      await prepared(page, host.origin);
      await page.getByRole('combobox').selectOption(locale);
      await setOffline(context, true);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Spendspacey' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const second = await context.newPage();
      await disableHttpCache(second, true);
      await second.goto(host.origin);

      await expect(second.getByRole('heading', { name: 'Spendspacey' })).toBeVisible();
      await expect(second.getByRole('combobox')).toHaveValue(locale);
      await second.getByRole('combobox').selectOption(locale === 'en' ? 'pt-BR' : 'en');
      await second.getByRole('button', { name: /Sign in with Google|Entrar com o Google/ }).click();
      await expect(second.getByRole('alert')).toContainText(
        /Connect to sign in|Conecte-se para entrar/,
      );
      // Required local font/image and lazy SDK remain available with HTTP cache off.
      expect(await second.evaluate(async () => (await fetch('/google-g.png')).ok)).toBe(true);
      expect(
        await second.evaluate(async () => (await fetch('/fonts/google-sans-medium.woff2')).ok),
      ).toBe(true);
    } finally {
      await setOffline(context, false);
      await host.close();
    }
  });

test('manifest diagnostics, standalone metadata and no service-worker support fallback', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  try {
    await prepared(page, host.origin);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    const manifest = await cdp.send('Page.getAppManifest');
    expect(manifest.errors).toEqual([]);
    expect(JSON.parse(manifest.data!).id).toBe('/');
    expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe(
      '/icons/apple-touch-icon.png',
    );
    expect(
      await page.evaluate(async () => {
        const image = await createImageBitmap(
          await (await fetch('/icons/maskable-512.png')).blob(),
        );
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const drawing = canvas.getContext('2d')!;
        drawing.drawImage(image, 0, 0);
        const pixels = drawing.getImageData(0, 0, image.width, image.height).data;
        for (let y = 0; y < image.height; y++)
          for (let x = 0; x < image.width; x++) {
            const offset = (y * image.width + x) * 4;
            if (pixels[offset + 3] !== 255) return false;
            if (
              Math.hypot(x - 256, y - 256) > 204.8 &&
              (pixels[offset] !== 24 || pixels[offset + 1] !== 77 || pixels[offset + 2] !== 63)
            )
              return false;
          }
        return true;
      }),
    ).toBe(true);
    for (const feature of ['serviceWorker', 'caches']) {
      const unsupported = await context.browser()!.newContext();
      await unsupported.addInitScript((feature) => {
        Object.defineProperty(feature === 'serviceWorker' ? navigator : window, feature, {
          value: undefined,
        });
      }, feature);
      const online = await unsupported.newPage();
      await online.goto(host.origin);
      await expect(online.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
      await expect(online.getByTestId('offline-readiness')).toContainText('unavailable');
      await unsupported.close();
    }
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

test('Auth, OAuth, token, API, avatars and arbitrary static queries bypass every worker cache', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await context.route('https://auth.example.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/authorize'))
        return route.fulfill({
          status: 302,
          headers: { location: `${host.origin}/auth/callback?code=synthetic-code` },
        });
      if (url.pathname.endsWith('/token')) return route.fulfill({ json: syntheticSession() });
      if (url.pathname.endsWith('/user')) return route.fulfill({ json: syntheticSession().user });
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
      return route.fulfill({ body: 'synthetic-private-marker' });
    });
    await context.route('https://images.example.test/**', (route) =>
      route.fulfill({ status: 404, body: 'synthetic-private-marker' }),
    );
    await prepared(page, host.origin);
    const before = await inventory(page);
    const beforeNavigationRequests = host.state.requests.length;
    await context.route('https://accounts.google.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: 'synthetic-private-marker' }),
    );
    await page.goto('https://accounts.google.com/o/oauth2/v2/auth?code=synthetic-private-marker');
    await page.goto(host.origin);
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    const main = before.find(({ url }) => /assets\/index-.*\.js/.test(url))!;
    const routed = await page.evaluate(async (main) => {
      const results = [];
      for (const [path, init] of [
        ['https://auth.example.test/rest/v1/private', undefined],
        ['/api/profiles/private', undefined],
        ['/auth/v1/token', undefined],
        ['/oauth/authorize', undefined],
        [main + '?private=token', undefined],
        [main, { headers: { authorization: 'Bearer synthetic-private-marker' } }],
        ['/api/logout', { method: 'POST', body: 'synthetic-private-marker' }],
      ] as const)
        results.push(await (await fetch(path, init)).text());
      return results;
    }, main.url.split('?')[0]);
    expect(routed).toEqual(Array(7).fill('synthetic-private-marker'));
    await setOffline(context, true);

    const callback = await page.goto(
      `${host.origin}/auth/callback?code=synthetic-private-code#access_token=synthetic-private-marker`,
    );
    expect(callback?.headers()['cache-control']).toBe('no-store');
    expect(callback?.headers()['referrer-policy']).toBe('no-referrer');
    await expect(page.getByRole('alert')).toContainText('could not finish offline');
    await expect(page).toHaveURL(`${host.origin}/auth/callback`);
    const after = await inventory(page);
    expect(after.map(({ url }) => url).sort()).toEqual(before.map(({ url }) => url).sort());
    for (const item of after) {
      expect(item.name).toMatch(/^spendspacey-static-v1$/);
      expect(new URL(item.url).origin).toBe(host.origin);
      expect(item.url).not.toMatch(/callback|token|oauth|\/api\/|\/auth\/|profiles|private|avatar/);
      expect(
        [...new URL(item.url).searchParams.keys()].every((key) => key === '__WB_REVISION__'),
      ).toBe(true);
      expect(item.body).not.toMatch(
        /synthetic-private-marker|person@example.test|Test Person|synthetic-code/,
      );
    }
    expect(host.state.requests.length).toBeGreaterThan(beforeNavigationRequests);
    expect(errors).toEqual([]);
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

test('expired SDK session offline never blocks language controls or invents sign-out', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  try {
    await prepared(page, host.origin);
    const expired = syntheticSession();
    expired.expires_at = 1;
    const key = `sb-${new URL(SYNTHETIC_ENV.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    await page.evaluate(({ key, expired }) => localStorage.setItem(key, JSON.stringify(expired)), {
      key,
      expired,
    });
    await setOffline(context, true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(
      await page.evaluate(async () => {
        try {
          await fetch('/uncached-network-proof');
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Connect to restore', { timeout: 12_000 });
    await page.getByRole('combobox').selectOption('pt-BR');
    await expect(page.getByRole('alert')).toContainText('Conecte-se');
    await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeTruthy();
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

test('complete replacement waits for all clients, cleans only owned assets, and launches offline', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  host.state.directory = '.cache/installable-offline-shell/v1';
  try {
    await prepared(page, host.origin);
    const old = (await inventory(page)).map(({ url }) => url);
    await context.route('https://images.example.test/**', (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.evaluate(
      (session) => localStorage.setItem('sb-auth-auth-token', JSON.stringify(session)),
      syntheticSession(),
    );
    await page.evaluate(async () => {
      localStorage.setItem('spendspacey.locale', 'pt-BR');
      localStorage.setItem('sdk-storage-sentinel', 'preserve');
      await (await caches.open('unrelated-cache')).put('/unrelated', new Response('preserve'));
      await (await caches.open('spendspacey-static-v0')).put('/old', new Response('obsolete'));
    });
    const second = await context.newPage();
    await second.goto(host.origin);
    host.state.directory = '.cache/installable-offline-shell/v2';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect(page.getByText('An update is ready.', { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    expect(await page.locator('html').getAttribute('data-synthetic-version')).toBe('v1');
    await page.close();
    expect(
      await second.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration())!.waiting,
      ),
    ).toBe(true);
    await second.close();
    const replacement = await context.newPage();
    await disableHttpCache(replacement);
    await replacement.goto(host.origin);
    await expect(replacement.locator('html')).toHaveAttribute('data-synthetic-version', 'v2');
    await expect(replacement.getByTestId('offline-readiness')).toContainText(
      'pronta para uso offline',
    );
    await expect(replacement.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    expect(
      await replacement.evaluate(() => localStorage.getItem('sb-auth-auth-token')),
    ).toBeTruthy();
    expect(await replacement.evaluate(() => localStorage.getItem('sdk-storage-sentinel'))).toBe(
      'preserve',
    );
    const keys = await replacement.evaluate(() => caches.keys());
    expect(keys).toContain('unrelated-cache');
    expect(keys).not.toContain('spendspacey-static-v0');
    const current = await inventory(replacement);
    for (const url of old.filter((url) => /assets\/index-.*\.js|index\.html/.test(url)))
      expect(current.some((item) => item.url === url)).toBe(false);
    await setOffline(context, true);
    await replacement.reload();
    await expect(replacement.locator('html')).toHaveAttribute('data-synthetic-version', 'v2');
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

test('failed replacement with fallback HTML retains the complete old offline shell', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  host.state.directory = '.cache/installable-offline-shell/v1';
  try {
    await prepared(page, host.origin);
    host.state.directory = '.cache/installable-offline-shell/v2';
    host.state.broken = true;
    await page.evaluate(async () => {
      const reg = (await navigator.serviceWorker.getRegistration())!;
      await reg.update();
      await new Promise<void>((resolve) => {
        const worker = reg.installing;
        if (!worker) return resolve();
        worker.addEventListener('statechange', () => {
          if (worker.state === 'redundant') resolve();
        });
      });
    });
    expect(
      await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting),
    ).toBe(false);
    await expect(page.getByText('An update is ready.', { exact: false })).toHaveCount(0);
    await setOffline(context, true);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-synthetic-version', 'v1');
    await expect(page.getByTestId('offline-readiness')).toContainText('ready for offline');
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

for (const corruption of ['missing', 'mismatched'])
  test(`${corruption} chunks repair once online, preserve storage, and never reload callbacks`, async ({
    page,
    context,
  }) => {
    const host = await pwaServer();
    try {
      await prepared(page, host.origin);
      await page.evaluate(async (corruption) => {
        localStorage.setItem('sdk-storage-sentinel', 'preserve');
        const cache = await caches.open('spendspacey-static-v1');
        for (const request of await cache.keys()) {
          if (!/supabase-.*\.js/.test(request.url)) continue;
          if (corruption === 'missing') await cache.delete(request);
          else
            await cache.put(
              request,
              new Response('wrong bytes', {
                headers: { 'content-type': 'application/javascript' },
              }),
            );
        }
      }, corruption);
      await setOffline(context, true);
      // The actual lazy import now fails through Vite's preload handler.
      await page.reload();
      await expect(page.getByRole('alert').filter({ hasText: 'Some app files' })).toBeVisible();
      await page.getByRole('button', { name: 'Repair and reload online' }).click();
      expect(
        await page.evaluate(() => sessionStorage.getItem('spendspacey.static-repair-attempt')),
      ).toBeNull();
      await setOffline(context, false);
      await Promise.all([
        page.waitForEvent('load'),
        page.getByRole('button', { name: 'Repair and reload online' }).click(),
      ]);
      await expect(page.getByTestId('offline-readiness')).toContainText('ready for offline');
      expect(await page.evaluate(() => localStorage.getItem('sdk-storage-sentinel'))).toBe(
        'preserve',
      );
      // Persisted guard prevents repeated repair/reload when the same failure recurs.
      await page.evaluate(() => {
        sessionStorage.setItem('spendspacey.static-repair-attempt', '1');
        window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
      });
      await page.getByRole('button', { name: 'Repair and reload online' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Some app files' })).toBeVisible();
      await page.goto(`${host.origin}/auth/callback?error=access_denied`);
      await page.evaluate(() =>
        window.dispatchEvent(new Event('vite:preloadError', { cancelable: true })),
      );
      await expect(page.getByRole('button', { name: 'Repair and reload online' })).toHaveCount(0);
    } finally {
      await setOffline(context, false);
      await host.close();
    }
  });

test('first-ever offline launch has no prepared app-owned shell', async ({ page, context }) => {
  const host = await pwaServer();
  try {
    await disableHttpCache(page);
    await setOffline(context, true);
    await expect(page.goto(host.origin)).rejects.toThrow();
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

test('offline logout preserves the session; actual SDK failure follows cleared local state', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  let logoutRequests = 0;
  try {
    await context.route('https://images.example.test/**', (route) =>
      route.fulfill({ status: 404 }),
    );
    await context.route('https://auth.example.test/auth/v1/logout**', (route) => {
      logoutRequests++;
      return route.fulfill({ status: 500, json: { message: 'synthetic-private-marker' } });
    });
    await prepared(page, host.origin);
    await page.evaluate(
      (session) => localStorage.setItem('sb-auth-auth-token', JSON.stringify(session)),
      syntheticSession(),
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    await setOffline(context, true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Connect to sign out');
    expect(logoutRequests).toBe(0);
    await setOffline(context, false);
    expect(logoutRequests).toBe(0);
    await page.getByRole('button', { name: 'Try the connection' }).click();
    await expect(page.getByRole('alert')).toContainText('could not sign you out');
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('sb-auth-auth-token'))).toBeNull();
    await expect(page.getByRole('alert')).toContainText('Your local session may have ended');
    expect(logoutRequests).toBe(1);
    await page.getByRole('combobox').selectOption('pt-BR');
    await expect(page.getByRole('alert')).toContainText('Não foi possível sair');
    await expect(page.getByRole('main')).not.toContainText('synthetic-private-marker');
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});
