import { readFileSync } from 'node:fs';
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
  await expect(page.getByTestId('offline-readiness')).toContainText('Prepared for offline', {
    timeout: 20000,
  });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
  await page.reload();
  await expect(page.getByTestId('offline-readiness')).toContainText('ready for offline', {
    timeout: 20000,
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
    expect(
      after
        .filter((i) => i.name.includes('resource-v3'))
        .map(({ url }) => url)
        .sort(),
    ).toEqual(
      before
        .filter((i) => i.name.includes('resource-v3'))
        .map(({ url }) => url)
        .sort(),
    );
    for (const item of after) {
      expect(item.name).toMatch(/^spendspacey-static-(resource|ownership)-v3/);
      expect(new URL(item.url).origin).toBe(host.origin);
      expect(item.url).not.toMatch(
        /callback|token|oauth|\/api\/|\/auth\/|profiles|private|avatar|index\.html/,
      );
      expect(new URL(item.url).search).toBe('');
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

async function records(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('spendspacey-static-ownership-v3');
    return (await Promise.all(
      (await cache.keys()).map(async (request) => await (await cache.match(request))!.json()),
    )) as { id: string; body: Record<string, unknown> }[];
  });
}
async function selection(page: Page) {
  const rows = await records(page);
  const commits = rows
    .filter((row) => row.body.kind === 'activate' || row.body.kind === 'deliver')
    .sort((a, b) => Number(a.body.sequence) - Number(b.body.sequence));
  const head = [commits.at(-1)!];
  const complete = rows.find((row) => row.id === head[0].body.selected)!;
  const reservation = rows.find((row) => row.id === complete.body.reservation)!;
  return {
    head: head[0],
    complete,
    cache: 'spendspacey-static-resource-v3-' + String(reservation.body.instance),
  };
}
async function message(page: Page, operation: string, details: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ operation, details }) => {
      const worker =
        navigator.serviceWorker.controller ??
        (await navigator.serviceWorker.getRegistration())!.active!;
      async function send(op: string, correlation?: Record<string, unknown>) {
        return new Promise<Record<string, unknown>>((resolve) => {
          const channel = new MessageChannel();
          const request =
            typeof details.request === 'string' ? details.request : crypto.randomUUID();
          const timer = setTimeout(() => {
            channel.port1.close();
            resolve({});
          }, 20000);
          channel.port1.onmessage = (event) => {
            if (
              event.data.protocol !== 3 ||
              event.data.request !== request ||
              event.data.operation !== op
            )
              return;
            clearTimeout(timer);
            channel.port1.close();
            resolve(event.data.status);
          };
          worker.postMessage(
            {
              protocol: 3,
              operation: op,
              request,
              ...(correlation
                ? {
                    worker: correlation.worker,
                    epoch: correlation.epoch,
                    binding: correlation.binding,
                  }
                : {}),
            },
            [channel.port2],
          );
        });
      }
      const hello = await send('HELLO');
      return operation === 'STATUS' ? hello : send(operation, hello);
    },
    { operation, details },
  );
}
async function waitReplacement(
  page: Page,
  directory: string,
  host: Awaited<ReturnType<typeof pwaServer>>,
) {
  host.state.directory = directory;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  const expectedScript = readFileSync(directory + '/index.html', 'utf8').match(
    /src="([^"]+\.js)"/,
  )![1];
  await expect
    .poll(
      async () =>
        page.evaluate(async (expectedScript) => {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.waiting?.state !== 'installed' || reg.installing) return false;
          const meta = await caches.open('spendspacey-static-ownership-v3');
          const rows = await Promise.all(
            (await meta.keys()).map(async (r) => (await meta.match(r))!.json()),
          );
          return rows.some(
            (row) =>
              row.body.kind === 'complete' &&
              rows
                .find((r) => r.id === row.body.reservation)
                .body.descriptor.entries.some((e: { url: string }) => e.url === expectedScript),
          );
        }, expectedScript),
      { timeout: 20000 },
    )
    .toBe(true);
}

async function damageWaiting(page: Page, corruption: string) {
  await page.evaluate(async (corruption) => {
    const meta = await caches.open('spendspacey-static-ownership-v3');
    const rows = await Promise.all(
      (await meta.keys()).map(async (r) => (await meta.match(r))!.json()),
    );
    const used = new Set(
      rows
        .filter((r) => r.body.kind === 'activate' || r.body.kind === 'deliver')
        .map((r) => r.body.selected),
    );
    const c = rows.filter((r) => r.body.kind === 'complete' && !used.has(r.id)).at(-1)!;
    const r = rows.find((r) => r.id === c.body.reservation).body;
    const cache = await caches.open('spendspacey-static-resource-v3-' + r.instance);
    const entry = r.descriptor.entries.find((e: { url: string }) =>
      /^\/assets\/index-.*\.js$/.test(e.url),
    );
    if (corruption === 'missing') await cache.delete(entry.key);
    else
      await cache.put(
        entry.key,
        new Response('corrupt bytes', { headers: { 'content-type': 'application/javascript' } }),
      );
  }, corruption);
}
async function damageSelected(page: Page, path = 'supabase', kind = 'missing') {
  const selected = await selection(page);
  return page.evaluate(
    async ({ name, path, kind }) => {
      const cache = await caches.open(name);
      const entry = (await cache.keys()).find((r) =>
        path === '/'
          ? new URL(r.url).pathname === '/'
          : path === 'bootstrap'
            ? /\/assets\/index-.*\.js$/.test(r.url)
            : r.url.includes('supabase-'),
      )!;
      if (kind === 'missing') await cache.delete(entry);
      else
        await cache.put(
          entry,
          new Response('corrupt', {
            headers: { 'content-type': path === '/' ? 'text/html' : 'application/javascript' },
          }),
        );
      return new URL(entry.url).pathname;
    },
    { name: selected.cache, path, kind },
  );
}
async function reopen(context: BrowserContext, origin: string) {
  for (const page of context.pages()) await page.close();
  const page = await context.newPage();
  await disableHttpCache(page);
  await page.goto(origin);
  return page;
}

test('one online preparation persists canonical / and the next ordinary load is controlled offline', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  try {
    await disableHttpCache(page);
    await page.goto(host.origin);
    await expect(page.getByTestId('offline-readiness')).toContainText('Prepared for offline', {
      timeout: 20000,
    });
    expect(host.state.requests).not.toContain('/index.html');
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    const redirect = await context.request.get(host.origin + '/index.html?synthetic=1', {
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/?synthetic=1');
    await setOffline(context, true);
    await page.reload();
    await expect(page.getByTestId('offline-readiness')).toContainText('ready for offline');
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Spendspacey' })).toBeVisible();
    await expect(page.goto(host.origin + '/index.html')).rejects.toThrow();
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

test('unknown, missing, API and query-bearing paths have no offline worker fallback', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  try {
    await prepared(page, host.origin);
    const before = await inventory(page);
    await setOffline(context, true);
    for (const path of [
      '/unknown',
      '/assets/missing-abcdefgh.js',
      '/api/private',
      '/?private=value',
    ]) {
      expect(
        await page.evaluate(async (path) => {
          try {
            await fetch(path);
            return false;
          } catch {
            return true;
          }
        }, path),
      ).toBe(true);
    }
    expect(
      (await inventory(page))
        .filter((i) => i.name.includes('resource-v3'))
        .map((item) => item.url)
        .sort(),
    ).toEqual(
      before
        .filter((i) => i.name.includes('resource-v3'))
        .map((item) => item.url)
        .sort(),
    );
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

for (const corruption of ['missing', 'bytes'])
  test(`damaged waiting v2 (${corruption}) activates offline with intact v1 and survives worker restart`, async ({
    page,
    context,
  }) => {
    const host = await pwaServer();
    host.state.directory = '.cache/installable-offline-shell/v1';
    try {
      await prepared(page, host.origin);
      const first = await selection(page);
      await waitReplacement(page, '.cache/installable-offline-shell/v2', host);
      await damageWaiting(page, corruption);
      await setOffline(context, true);
      const fresh = await reopen(context, host.origin);
      await expect(fresh.locator('html')).toHaveAttribute('data-synthetic-version', 'v1');
      await expect(fresh.getByTestId('offline-readiness')).toContainText('ready for offline');
      expect((await selection(fresh)).head.body.selected).toBe(first.head.body.selected);
      const cdp = await context.newCDPSession(fresh);
      await cdp.send('ServiceWorker.enable');
      await cdp.send('ServiceWorker.stopAllWorkers');
      await fresh.reload();
      await expect(fresh.locator('html')).toHaveAttribute('data-synthetic-version', 'v1');
      await expect(fresh.getByTestId('offline-readiness')).toContainText('ready for offline');
      expect((await message(fresh, 'STATUS')).ready).toBe(true);
    } finally {
      await setOffline(context, false);
      await host.close();
    }
  });

test('complete v1 → v2 → v1 rollback preserves whole offline generations and SDK/locale storage', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  host.state.directory = '.cache/installable-offline-shell/v1';
  try {
    await prepared(page, host.origin);
    await page.evaluate(() => {
      localStorage.setItem('sdk-storage-sentinel', 'preserve');
      localStorage.setItem('spendspacey.locale', 'pt-BR');
    });
    let active = page;
    for (const version of ['v2', 'v1']) {
      await waitReplacement(active, '.cache/installable-offline-shell/' + version, host);
      await expect(active.locator('html')).toHaveAttribute(
        'data-synthetic-version',
        version === 'v2' ? 'v1' : 'v2',
      );
      active = await reopen(context, host.origin);
      await expect(active.locator('html')).toHaveAttribute('data-synthetic-version', version);
      await expect(active.getByTestId('offline-readiness')).toContainText(
        'pronta para uso offline',
      );
      await setOffline(context, true);
      await active.reload();
      await expect(active.locator('html')).toHaveAttribute('data-synthetic-version', version);
      await setOffline(context, false);
    }
    expect(await active.evaluate(() => localStorage.getItem('sdk-storage-sentinel'))).toBe(
      'preserve',
    );
    expect((await records(active)).filter((row) => row.body.kind === 'activate')).toHaveLength(3);
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});

for (const failure of ['redirect', 'fallback HTML'])
  test(`failed replacement (${failure}) retains the previous complete worker`, async ({
    page,
    context,
  }) => {
    const host = await pwaServer();
    host.state.directory = '.cache/installable-offline-shell/v1';
    try {
      await prepared(page, host.origin);
      host.state.directory = '.cache/installable-offline-shell/v2';
      if (failure === 'redirect') host.state.redirectPath = '/';
      else host.state.broken = true;
      await page.evaluate(async () => {
        const reg = (await navigator.serviceWorker.getRegistration())!;
        await reg.update();
        if (reg.installing)
          await new Promise<void>((resolve) => {
            const worker = reg.installing!;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'redundant') resolve();
            });
          });
      });
      expect(
        await page.evaluate(
          async () => !!(await navigator.serviceWorker.getRegistration())!.waiting,
        ),
      ).toBe(false);
      await setOffline(context, true);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-synthetic-version', 'v1');
    } finally {
      await setOffline(context, false);
      await host.close();
    }
  });

for (const locale of ['en', 'pt-BR'])
  test(`embedded cold recovery and deliberate repair adopts on reload, preserving old documents: ${locale}`, async ({
    page,
    context,
  }) => {
    const host = await pwaServer();
    try {
      await prepared(page, host.origin);
      await page.getByRole('combobox').selectOption(locale);
      const old = await context.newPage();
      await old.goto(host.origin);
      await expect(old.getByTestId('offline-readiness')).toContainText(/ready|pronta/);
      const original = (await selection(page)).head.body.selected;
      const sdk = await damageSelected(page);
      const requests: string[] = [];
      const pageSdkImports: string[] = [];
      context.on('request', (r) => {
        requests.push(r.url());
        if (new URL(r.url()).pathname === sdk && !r.serviceWorker()) pageSdkImports.push(r.url());
      });
      const start = host.state.requests.length;
      const response = await page.reload();
      await expect(
        page.getByRole('heading', { name: /Spendspacey recovery|Recuperação do Spendspacey/ }),
      ).toBeVisible();
      expect(response!.headers()['cache-control']).toBe('no-store');
      expect(response!.headers()['content-security-policy']).toContain("connect-src 'none'");
      expect(host.state.requests.slice(start)).not.toContain('/');
      await expect(
        page.getByRole('button', { name: /^Repair online$|^Reparar com conexão$/ }),
      ).toBeEnabled();
      await page.getByRole('button', { name: /^Repair online$|^Reparar com conexão$/ }).click();
      await expect(page.getByRole('status')).toContainText(
        /Verified repair is ready|O reparo verificado está pronto/,
        { timeout: 20000 },
      );
      expect((await selection(page)).head.body.selected).toBe(original);
      expect(
        requests.filter((url) =>
          /auth\.example|supabase\.|google\.|\/(?:auth|oauth|user|session|profile|api)(?:\/|\?|$)/i.test(
            url,
          ),
        ),
      ).toEqual([]);
      expect(pageSdkImports).toEqual([]);
      expect(host.state.requests.slice(start).filter((path) => path !== '/sw.js')).toEqual([sdk]);
      const oldStatus = await message(old, 'STATUS');
      expect(oldStatus.ready).toBe(false);
      const oldBinding = oldStatus.binding;
      await page.reload();
      await expect(page.getByTestId('offline-readiness')).toContainText(/ready|pronta/);
      expect((await message(old, 'STATUS')).binding).toBe(oldBinding);
      expect((await message(old, 'STATUS')).ready).toBe(false);
      await setOffline(context, true);
      await page.reload();
      await expect(page.getByTestId('offline-readiness')).toContainText(/ready|pronta/);
    } finally {
      await setOffline(context, false);
      await host.close();
    }
  });

for (const online of [true, false])
  test(`missing lazy chunk survives cold reopen with recovery online=${online}`, async ({
    page,
    context,
  }) => {
    const host = await pwaServer();
    try {
      await prepared(page, host.origin);
      await damageSelected(page);
      await setOffline(context, !online);
      for (const p of context.pages()) await p.close();
      const fresh = await context.newPage();
      await disableHttpCache(fresh, !online);
      await fresh.goto(host.origin);
      await expect(fresh.getByRole('heading', { name: 'Spendspacey recovery' })).toBeVisible();
      await expect(fresh.getByRole('status')).toContainText(
        online ? 'Choose Repair online' : 'You appear to be offline',
      );
      expect((await message(fresh, 'STATUS')).authority).toBe('recovery');
    } finally {
      await setOffline(context, false);
      await host.close();
    }
  });
for (const path of ['/', 'bootstrap'])
  for (const kind of ['missing', 'corrupt'])
    test(`independent recovery for ${kind} ${path}`, async ({ page, context }) => {
      const host = await pwaServer();
      try {
        await prepared(page, host.origin);
        await damageSelected(page, path, kind);
        await setOffline(context, true);
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Spendspacey recovery' })).toBeVisible();
      } finally {
        await setOffline(context, false);
        await host.close();
      }
    });
test('failed, timed-out and cancelled recovery preserves files and duplicate attempts remain spent', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const host = await pwaServer();
  try {
    await prepared(page, host.origin);
    const original = (await selection(page)).head.body.selected;
    const sdk = await damageSelected(page);
    await page.reload();
    host.state.redirectPath = sdk;
    const request = crypto.randomUUID();
    expect((await message(page, 'REPAIR', { request })).repair).toBe('failed');
    const count = host.state.requests.length;
    await message(page, 'REPAIR', { request });
    expect(host.state.requests.length).toBe(count);
    host.state.redirectPath = '';
    host.state.delayPath = sdk;
    await page.getByRole('button', { name: 'Repair online', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('deadline', { timeout: 20000 });
    await page.getByRole('button', { name: 'Repair online', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancel repair', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel repair', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('cancelled');
    expect((await selection(page)).head.body.selected).toBe(original);
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});
test('recovery enforces exact CSP and handles denied locale storage without executing Auth', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  try {
    await prepared(page, host.origin);
    await damageSelected(page);
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Denied', 'SecurityError');
        },
      });
    });
    const calls: string[] = [];
    context.on('request', (r) => calls.push(r.url()));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Spendspacey recovery' })).toBeVisible();
    await page.getByRole('combobox').selectOption('pt-BR');
    await expect(page.getByRole('heading', { name: 'Recuperação do Spendspacey' })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'window.__unexpectedRecoveryExecution=true';
        document.body.append(script);
        return '__unexpectedRecoveryExecution' in window;
      }),
    ).toBe(false);
    expect(calls.filter((url) => /supabase-|auth\.example|google/.test(url))).toEqual([]);
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});
test('legacy privileged messages have no authority and unrelated caches remain untouched', async ({
  page,
}) => {
  const host = await pwaServer();
  try {
    await prepared(page, host.origin);
    await page.evaluate(async () => {
      await (await caches.open('spendspacey-static-v1')).put('/', new Response('legacy'));
      await (await caches.open('unrelated')).put('/', new Response('keep'));
      navigator.serviceWorker.controller!.postMessage({ type: 'CLEANUP' });
    });
    expect(await page.evaluate(() => caches.has('spendspacey-static-v1'))).toBe(true);
    expect(await page.evaluate(() => caches.has('unrelated'))).toBe(true);
  } finally {
    await host.close();
  }
});

test('first-ever offline launch has no app-owned shell', async ({ page, context }) => {
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

test('actual 069dbc50 worker installs, cuts over through normal waiting, imports static bytes and preserves SDK/locale storage', async ({
  page,
  context,
}) => {
  const host = await pwaServer();
  host.state.directory = '.cache/installable-offline-shell/legacy-069dbc50';
  try {
    await prepared(page, host.origin);
    await expect(page.locator('html')).toHaveAttribute('data-synthetic-version', 'legacy-069dbc50');
    const legacyNames = await page.evaluate(async () => {
      localStorage.setItem('spendspacey.locale', 'pt-BR');
      localStorage.setItem('sdk-storage-sentinel', 'preserved');
      return caches.keys();
    });
    host.state.directory = 'dist';
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const r = await navigator.serviceWorker.getRegistration();
            return r?.waiting?.state;
          }),
        { timeout: 20000 },
      )
      .toBe('installed');
    await expect(page.locator('html')).toHaveAttribute('data-synthetic-version', 'legacy-069dbc50');
    const cutover = await records(page);
    expect(cutover.some((r) => r.body.kind === 'cutover')).toBe(true);
    expect(cutover.some((r) => r.body.kind === 'reserve' && r.body.purpose === 'import')).toBe(
      true,
    );
    const fresh = await reopen(context, host.origin);
    await expect(fresh.getByTestId('offline-readiness')).toContainText('pronta para uso offline');
    for (const name of legacyNames)
      expect(await fresh.evaluate((name) => caches.has(name), name)).toBe(true);
    expect(await fresh.evaluate(() => localStorage.getItem('sdk-storage-sentinel'))).toBe(
      'preserved',
    );
    await setOffline(context, true);
    const cdp = await context.newCDPSession(fresh);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await fresh.reload();
    await expect(fresh.getByTestId('offline-readiness')).toContainText('pronta para uso offline');
  } finally {
    await setOffline(context, false);
    await host.close();
  }
});
