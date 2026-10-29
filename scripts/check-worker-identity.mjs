// Supplemental disposable WebKit check; does not expand the PR CI browser matrix.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webkit } from '@playwright/test';
const diagnostic = `
self.__identity = [];
const identity = () => ({ supported: !!self.serviceWorker, active: !!self.serviceWorker && self.registration.active === self.serviceWorker, state: self.serviceWorker?.state });
self.addEventListener('install', () => self.__identity.push({event:'install', ...identity()}));
self.addEventListener('activate', () => self.__identity.push({event:'activate', ...identity()}));
self.addEventListener('message', event => { if(event.data === 'IDENTITY_DIAGNOSTIC' && event.ports[0]) event.ports[0].postMessage({timing:self.__identity, now:identity()}); });
`;
const mime = (path) =>
  path.endsWith('.js')
    ? 'application/javascript'
    : path.endsWith('.css')
      ? 'text/css'
      : path.endsWith('.png')
        ? 'image/png'
        : path.endsWith('.woff2')
          ? 'font/woff2'
          : path.endsWith('.webmanifest')
            ? 'application/manifest+json'
            : 'text/html';
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://local').pathname;
    let bytes = await readFile(resolve('dist', path === '/' ? 'index.html' : path.slice(1)));
    if (path === '/sw.js') bytes = Buffer.concat([Buffer.from(diagnostic), bytes]);
    res
      .writeHead(200, {
        'Content-Type': mime(path),
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/',
      })
      .end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = 'http://localhost:' + server.address().port;
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext();
  const external = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      external.push('unexpected external request');
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page
    .getByTestId('offline-readiness')
    .filter({ hasText: 'Prepared for offline' })
    .waitFor({ timeout: 20000 });
  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    // ready may resolve while activation is still running. Preserve the activate
    // event's timing observation, then bound the separate post-activation probe.
    const active = registration.active;
    if (active.state !== 'activated') {
      await new Promise((resolve, reject) => {
        const finish = (error) => {
          clearTimeout(deadline);
          active.removeEventListener('statechange', changed);
          if (error) reject(error);
          else resolve();
        };
        const changed = () => {
          if (registration.active !== active || active.state === 'redundant')
            finish(Error('Disposable identity probe lost its active worker'));
          else if (active.state === 'activated') finish();
        };
        const deadline = setTimeout(
          () => finish(Error('Disposable identity probe activation deadline')),
          10000,
        );
        active.addEventListener('statechange', changed);
        changed();
      });
    }
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => resolve(e.data);
      registration.active.postMessage('IDENTITY_DIAGNOSTIC', [channel.port2]);
    });
  });
  assert.deepEqual(result.timing, [
    { event: 'install', supported: true, active: false, state: 'installing' },
    { event: 'activate', supported: true, active: true, state: 'activating' },
  ]);
  assert.deepEqual(result.now, { supported: true, active: true, state: 'activated' });
  await page.reload();
  await page.getByTestId('offline-readiness').filter({ hasText: 'ready for offline' }).waitFor();
  assert.deepEqual(external, []);
  console.log(
    JSON.stringify({
      engine: 'disposable WebKit',
      version: browser.version(),
      nativeIdentity: result,
      actualCorrectedEnginePreparationAndNavigation: true,
      externalRequests: external.length,
      physicalIPhone: false,
    }),
  );
  await context.close();
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
