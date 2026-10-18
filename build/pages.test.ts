// @vitest-environment node
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';
import { pagesHeaders, pagesPolicy, renderPagesHeaders, validateHeaderLimits } from './pages';
import { unsafeOrigins } from '../test/unsafeOrigins';
import { matchPagesHeaders } from '../test/pagesHeaders';

const template = readFileSync('public/_headers', 'utf8');
const origin = 'https://auth.example.test';
it.each(['https://synthetic-app.pages.dev', 'https://deadbeef.synthetic-app.pages.dev:443/'])(
  'derives canonical Pages origin from %s',
  (value) => {
    expect(
      pagesPolicy({ CF_PAGES: '1', CF_PAGES_BRANCH: 'main', CF_PAGES_URL: value }, false),
    ).toEqual({ kind: 'production', origin: 'https://synthetic-app.pages.dev' });
  },
);
it.each([
  undefined,
  ...unsafeOrigins,
  'https://pages.dev',
  'https://a.b.c.pages.dev',
  'https://app.pages.dev.evil.test',
])('rejects missing/invalid Pages metadata %j for every branch', (value) => {
  for (const branch of ['main', 'feature', undefined])
    expect(() =>
      pagesPolicy({ CF_PAGES: '1', CF_PAGES_BRANCH: branch, CF_PAGES_URL: value }, false),
    ).toThrow('valid CF_PAGES_URL');
});
it('keeps preview/unclassified metadata denied and local builds separate', () => {
  for (const branch of ['feature', undefined])
    expect(
      pagesPolicy(
        {
          CF_PAGES: '1',
          CF_PAGES_BRANCH: branch,
          CF_PAGES_URL: 'https://deadbeef.synthetic-app.pages.dev',
        },
        true,
      ),
    ).toEqual({ kind: 'denied' });
  expect(pagesPolicy({}, false)).toEqual({ kind: 'denied' });
  expect(pagesPolicy({}, true)).toEqual({ kind: 'local' });
});
it.each(unsafeOrigins)('rejects unsafe CSP origin %j without rendering headers', (value) => {
  expect(() => renderPagesHeaders(template, value, [])).toThrow();
});
it('canonicalizes explicit default port in generated CSP', () => {
  expect(renderPagesHeaders(template, `${origin}:443/`, [])).toBe(
    renderPagesHeaders(template, origin, []),
  );
});
it('emits only the supplied safe fingerprinted inventory paths', () => {
  const text = renderPagesHeaders(template, origin, ['assets/main-abcdefgh.js']);
  expect(text).toContain(
    '/assets/main-abcdefgh.js\n  Cache-Control: public, max-age=31536000, immutable',
  );
  expect(text).not.toContain('/assets/*');
  expect(text).not.toContain('/assets/missing-abcdefgh.js');
  expect(() => renderPagesHeaders(template, origin, ['assets/plain.js'])).toThrow();
});
it('counts base and generated rules against the 100-rule limit', () => {
  const baseCount = template.split('\n').filter((line) => line.startsWith('/')).length;
  const assets = Array.from({ length: 100 - baseCount }, (_, i) => `assets/chunk${i}-abcdefgh.js`);
  expect(() => renderPagesHeaders(template, origin, assets)).not.toThrow();
  expect(() =>
    renderPagesHeaders(template, origin, [...assets, 'assets/extra-abcdefgh.js']),
  ).toThrow('100-rule');
});
it('enforces the 2,000-character limit on every line, including base rules', () => {
  expect(() => validateHeaderLimits(`#${'a'.repeat(1999)}\n/\n  X: a`)).not.toThrow();
  expect(() => validateHeaderLimits(`#${'a'.repeat(2000)}`)).toThrow('2,000-character');
  expect(() => renderPagesHeaders(`${template}\n  X: ${'a'.repeat(2000)}`, origin, [])).toThrow();
});

it('models Pages path matching independently of queries without making fallback HTML immutable', () => {
  const source = renderPagesHeaders(template, origin, ['assets/main-abcdefgh.js']);
  for (const query of ['', '?v=1']) {
    expect(
      matchPagesHeaders(source, `/assets/main-abcdefgh.js${query}`)['cache-control'],
    ).toContain('immutable');
    for (const path of [
      '/assets/missing.js',
      '/assets/missing-abcdefgh.js',
      '/ordinary/fallback',
    ]) {
      expect(matchPagesHeaders(source, `${path}${query}`)['cache-control']).toBe(
        'public, max-age=0, must-revalidate',
      );
    }
    expect(matchPagesHeaders(source, `/auth/callback${query}`)['cache-control']).toBe('no-store');
    for (const path of ['/', '/index.html'])
      expect(matchPagesHeaders(source, `${path}${query}`)['cache-control']).toBe('no-cache');
  }
});

it('generates rules from a real emitted bundle while excluding copied public hash lookalikes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spendspacey-header-inventory-'));
  try {
    await mkdir(join(root, 'public/assets'), { recursive: true });
    await writeFile(join(root, 'public/_headers'), template);
    await writeFile(
      join(root, 'public/assets/copied-abcdefgh.js'),
      '/* public file, no bundler fingerprint */',
    );
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(join(root, 'main.js'), 'document.title = "synthetic inventory";');
    await build({
      configFile: false,
      root,
      logLevel: 'silent',
      plugins: [pagesHeaders(origin, false)],
      build: { rolldownOptions: { output: { entryFileNames: 'assets/[name]-[hash].js' } } },
    });
    const html = await readFile(join(root, 'dist/index.html'), 'utf8');
    const emitted = /src="([^"]+\.js)"/.exec(html)![1];
    const source = await readFile(join(root, 'dist/_headers'), 'utf8');
    expect(matchPagesHeaders(source, emitted)['cache-control']).toContain('immutable');
    expect(await readFile(join(root, `dist${emitted}`), 'utf8')).toContain('synthetic inventory');
    for (const path of ['/assets/copied-abcdefgh.js', '/assets/absent-abcdefgh.js']) {
      expect(source).not.toContain(`${path}\n`);
      expect(matchPagesHeaders(source, `${path}?v=1`)['cache-control']).not.toContain('immutable');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
