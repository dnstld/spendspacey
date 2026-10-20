import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function checkPwa(outDir) {
  const read = (file) => readFileSync(resolve(outDir, file));
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const key of ['id', 'scope', 'start_url']) assert.equal(manifest[key], '/');
  for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'Spendspacey');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#f6f7f2');
  assert.equal(manifest.background_color, '#f6f7f2');
  assert.equal(manifest.prefer_related_applications, false);
  const html = read('index.html').toString();
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(html, /name="theme-color" content="#f6f7f2"/);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable|maximum-scale/);
  assert.match(html, /apple-mobile-web-app-capable.*yes/);
  assert.match(html, /apple-mobile-web-app-title.*Spendspacey/);
  assert.match(html, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon.png"/);
  for (const [path, size] of [
    ['icons/app-192.png', 192],
    ['icons/app-512.png', 512],
    ['icons/maskable-512.png', 512],
    ['icons/apple-touch-icon.png', 180],
  ]) {
    const png = read(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    // Decode IDAT to prove these are real image streams, not header stubs.
    const idat = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
        idat.push(png.subarray(offset + 8, offset + 8 + length));
      offset += 12 + length;
    }
    assert(inflateSync(Buffer.concat(idat)).length > size * size);
    if (path.includes('apple')) continue;
    const icon = manifest.icons.find((icon) => icon.src === `/${path}`);
    assert.equal(icon?.sizes, `${size}x${size}`);
    assert.equal(icon?.type, 'image/png');
    assert.equal(icon?.purpose, path.includes('maskable') ? 'maskable' : 'any');
  }
  const worker = read('sw.js').toString();
  assert.doesNotMatch(worker, /^\s*</);
  assert.doesNotMatch(worker, /self\.__WB_MANIFEST/);
  const injected = [...worker.matchAll(/\{"bytes":[^{}]+,"worker":"[a-f0-9]{64}"\}/g)].map(
    (match) => JSON.parse(match[0]),
  );
  for (const entry of injected) {
    const file = entry.url === '/' ? 'index.html' : entry.url.slice(1);
    const expectedType = file.endsWith('.js')
      ? 'application/javascript'
      : file.endsWith('.css')
        ? 'text/css'
        : file.endsWith('.png')
          ? 'image/png'
          : file.endsWith('.woff2')
            ? 'font/woff2'
            : file.endsWith('.webmanifest')
              ? 'application/manifest+json'
              : 'text/html';
    assert.equal(entry.type, expectedType);
    assert.equal(entry.key, entry.url);
    assert.equal(
      entry.integrity,
      'sha256-' + createHash('sha256').update(read(file)).digest('base64'),
    );
    assert.equal(entry.bytes, read(file).length);
    assert.match(entry.worker, /^[a-f0-9]{64}$/);
    assert.match(entry.implementation, /^[a-f0-9]{64}$/);
    assert.match(entry.compatibility, /^[a-f0-9]{64}$/);
    if (!entry.url.startsWith('/assets/')) assert.match(entry.revision, /^[a-f0-9]{32}$/);
    if (entry.revision)
      assert.equal(entry.revision, createHash('md5').update(read(file)).digest('hex'));
  }
  const entries = injected.map((entry) => entry.url);
  assert(entries.length >= 11, 'Expected injected canonical inventory');
  assert.equal(new Set(injected.map((entry) => entry.worker)).size, 1);
  assert.equal(new Set(injected.map((entry) => entry.compatibility)).size, 1);
  assert.equal(new Set(injected.map((entry) => entry.implementation)).size, 1);
  // Injected entry keys are canonicalized by Workbox. Bind each worker identity
  // to both the pre-injection implementation digest and the entire inventory.
  const { compatibility, implementation, worker: identity } = injected[0];
  const inventory = injected.map(({ bytes, integrity, key, revision, type, url }) => ({
    bytes,
    integrity,
    key,
    revision,
    type,
    url,
  }));
  assert.equal(
    identity,
    createHash('sha256')
      .update(JSON.stringify({ compatibility, entries: inventory, implementation }))
      .digest('hex'),
  );
  assert(!entries.includes('/index.html'));
  const expected = readdirSync(outDir, { recursive: true })
    .map(String)
    .filter(
      (path) =>
        /^assets\/[\w.-]+-[\w-]{8,}\.(js|css)$/.test(path) ||
        [
          'index.html',
          'manifest.webmanifest',
          'google-g.png',
          'fonts/google-sans-medium.woff2',
          'icons/app-192.png',
          'icons/app-512.png',
          'icons/maskable-512.png',
          'icons/apple-touch-icon.png',
        ].includes(path),
    );
  assert.deepEqual(
    entries.sort(),
    expected.map((file) => (file === 'index.html' ? '/' : '/' + file)).sort(),
    'Exact canonical static precache inventory',
  );
  assert(
    expected.some((path) => /^assets\/supabase-.*\.js$/.test(path)),
    'Required lazy SDK chunk',
  );
  for (const file of expected) assert(read(file).length > 0);
  console.log(
    `${outDir}: manifest, decoded icon dimensions, metadata, worker JS and ${entries.length} exact precache assets passed.`,
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) checkPwa(process.argv[2] ?? 'dist');
