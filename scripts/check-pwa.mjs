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
  const injected = [
    ...worker.matchAll(/\{"integrity":"sha256-[^"]+","revision":[^{}]*,"url":"[^"#?]+"\}/g),
  ].map((match) => JSON.parse(match[0]));
  for (const entry of injected)
    assert.equal(
      entry.integrity,
      'sha256-' + createHash('sha256').update(read(entry.url)).digest('base64'),
    );
  const entries = injected.map((entry) => entry.url);
  assert(entries.length >= 10, 'Expected injected precache entries');
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
  assert.deepEqual(entries.sort(), expected.sort(), 'Exact static precache inventory');
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
