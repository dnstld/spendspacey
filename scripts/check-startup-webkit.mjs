// Supplemental disposable WebKit evidence; never a physical-iPhone acceptance gate.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { webkit } from '@playwright/test';
import { pagesHeadersFor } from '../test/pagesHeaders.ts';
const types = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const prefix = `const cold = self.serviceWorker?.state === 'activated'; let injected = false;
const keys = CacheStorage.prototype.keys; CacheStorage.prototype.keys = async function() {
 if (cold && !injected) { injected = true; throw new DOMException('synthetic temporary access', 'UnknownError'); }
 return keys.call(this);
}; self.addEventListener('message', e => { if(e.data === 'NATIVE_PROOF' && e.ports[0]) e.ports[0].postMessage({ active: self.registration.active === self.serviceWorker, state: self.serviceWorker?.state, scope: self.registration.scope, origin: self.location.origin, injected }); });\n`;
const server = createServer((request, response) => {
  void (async () => {
    const path = new URL(request.url, 'http://localhost').pathname;
    assert(!path.includes('..'));
    if (path === '/index.html') {
      response.writeHead(308, { location: '/' }).end();
      return;
    }
    const file = path === '/' || path === '/auth/callback' ? 'index.html' : path.slice(1);
    const bytes = await readFile(resolve('dist', file)).catch(() => readFile('dist/index.html'));
    response
      .writeHead(200, {
        'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'text/html',
        ...pagesHeadersFor('dist', path),
      })
      .end(file === 'sw.js' ? Buffer.concat([Buffer.from(prefix), bytes]) : bytes);
  })().catch(() => response.writeHead(500).end());
});
await new Promise((resolve) => server.listen(5173, '127.0.0.1', resolve));
const origin = 'http://localhost:5173';
const profile = await mkdtemp(join(tmpdir(), 'spendspacey-startup-webkit-'));
const rounds = [];
const unexpected = [];
let context;
async function ready(page) {
  await page
    .getByTestId('offline-readiness')
    .filter({ hasText: /ready for offline|pronta para uso offline/ })
    .waitFor({ timeout: 20000 });
}
async function hello(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const channel = new MessageChannel(),
          request = crypto.randomUUID();
        channel.port1.onmessage = (e) => {
          if (e.data.request === request) {
            channel.port1.close();
            resolve(e.data.status);
          }
        };
        navigator.serviceWorker.controller.postMessage(
          { protocol: 3, operation: 'HELLO', request },
          [channel.port2],
        );
      }),
  );
}
try {
  let epoch;
  for (let round = 0; round < 4; round++) {
    context = await webkit.launchPersistentContext(profile, {
      headless: true,
      offline: round === 3,
    });
    context.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== origin ||
        /\/(auth\/v1|api|oauth|rest\/v1|token|session|user)(\/|$)/.test(url.pathname)
      )
        unexpected.push(url.origin + url.pathname);
    });
    // Routing disables ordinary HTTP cache; no real credentials/accounts are supplied.
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(origin);
    if (round === 0) {
      await page
        .getByTestId('offline-readiness')
        .filter({ hasText: 'Prepared for offline' })
        .waitFor({ timeout: 20000 });
      assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), false);
      await page.reload();
    }
    await ready(page);
    const state = await hello(page);
    assert.equal(state.ready, true);
    assert(state.binding);
    epoch ??= state.epoch;
    assert.equal(state.epoch, epoch);
    const proof = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => {
            channel.port1.close();
            resolve(e.data);
          };
          navigator.serviceWorker.controller.postMessage('NATIVE_PROOF', [channel.port2]);
        }),
    );
    assert.equal(proof.active, true);
    assert.equal(proof.state, 'activated');
    assert.equal(proof.scope, origin + '/');
    assert.equal(proof.origin, origin);
    if (round === 1 || round === 3) assert.equal(proof.injected, true);
    await page.getByRole('combobox').selectOption(round % 2 ? 'en' : 'pt-BR');
    if (round === 2) {
      // Only this disposable registration: retain static/locale data and owner.
      assert(
        await page.evaluate(async () =>
          (await navigator.serviceWorker.getRegistration()).unregister(),
        ),
      );
      await page.close();
      const network = await context.newPage();
      const response = await network.goto(origin);
      assert.equal(response.fromServiceWorker(), false);
      await network
        .getByTestId('offline-readiness')
        .filter({ hasText: /Prepared for offline|Preparado para uso offline/ })
        .waitFor({ timeout: 20000 });
      assert.equal(await network.evaluate(() => !!navigator.serviceWorker.controller), false);
    }
    rounds.push({
      round,
      workingBoundApplication: true,
      sameEpoch: true,
      nativeActive: true,
      coldReadInjected: proof.injected,
      offline: round === 3,
      version: context.browser()?.version(),
    });
    for (const document of context.pages()) await document.close();
    await context.close();
    context = undefined;
  }
  assert.deepEqual(unexpected, []);
  await mkdir('.cache', { recursive: true });
  const result = {
    supplementalWebKit: true,
    physicalIPhone: false,
    rounds,
    unexpectedRequests: 0,
    realAccountData: false,
  };
  await writeFile('.cache/startup-webkit-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await context?.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  await rm(profile, { recursive: true, force: true });
}
