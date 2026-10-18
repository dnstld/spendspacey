import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYNTHETIC_ENV } from '../test/config.ts';
import { pagesHeadersFor } from '../test/pagesHeaders.ts';
import { validateHeaderLimits } from '../build/pages.ts';

// Compile real Pages variants. Browser tests subsequently exercise these exact files.
for (const [label, branch, outDir] of [
  ['local', undefined, 'dist'],
  ['production', 'main', '.cache/deploy-auth-shell/production'],
  ['preview', 'feat/synthetic-preview', '.cache/deploy-auth-shell/preview'],
  ['unclassified', undefined, '.cache/deploy-auth-shell/unclassified'],
]) {
  const env = { ...process.env, ...SYNTHETIC_ENV };
  delete env.CF_PAGES;
  delete env.CF_PAGES_BRANCH;
  delete env.CF_PAGES_URL;
  if (label !== 'local') {
    env.CF_PAGES = '1';
    env.CF_PAGES_URL = 'https://deadbeef.synthetic-app.pages.dev';
  }
  if (branch) env.CF_PAGES_BRANCH = branch;
  console.log(`Checking synthetic Pages ${label} build.`);
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'build',
      '--outDir',
      outDir,
      '--mode',
      label === 'local' ? 'development' : 'production',
    ],
    { env, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Pages ${label} build failed`);
  const files = readdirSync(outDir, { recursive: true }).map(String).sort();
  assert(files.includes('index.html') && files.includes('_headers'));
  assert(files.includes('google-g.png') && files.includes('fonts/google-sans-medium.woff2'));
  assert(files.some((path) => /^assets\/.+-[\w-]+\.js$/.test(path)));
  assert(files.some((path) => /^assets\/.+-[\w-]+\.css$/.test(path)));
  for (const path of files) {
    assert(
      !/(^|\/)(404\.html|_redirects|_worker\.js|functions|test|src|\.env[^/]*)(\/|$)|\.map$/.test(
        path,
      ),
      `Unexpected published path: ${path}`,
    );
    assert(!/manifest|service-worker|(^|\/)sw\.js$/.test(path), 'PWA work is deferred');
  }
  const headers = readFileSync(resolve(outDir, '_headers'), 'utf8');
  validateHeaderLimits(headers);
  assert(!headers.includes('/assets/*'));
  const immutablePaths = [
    ...headers.matchAll(
      /^(\/assets\/[^\n]+)\n {2}Cache-Control: public, max-age=31536000, immutable$/gm,
    ),
  ]
    .map((match) => match[1])
    .sort();
  const assets = files.filter((path) => /^assets\/.+-[\w-]{8,}\.(js|css)$/.test(path));
  assert.deepEqual(immutablePaths, assets.map((path) => `/${path}`).sort());
  assert(!headers.includes('__SUPABASE_ORIGIN__'));
  assert(headers.includes(`connect-src 'self' ${SYNTHETIC_ENV.VITE_SUPABASE_URL};`));
  assert(!headers.includes(SYNTHETIC_ENV.VITE_SUPABASE_PUBLISHABLE_KEY));
  for (const path of ['/', '/index.html', '/google-g.png', '/fonts/google-sans-medium.woff2']) {
    assert.equal(pagesHeadersFor(outDir, path)['cache-control'], 'no-cache');
  }
  for (const path of ['/auth/callback', '/auth/callback?code=synthetic-code']) {
    const values = pagesHeadersFor(outDir, path);
    assert.equal(values['cache-control'], 'no-store');
    assert.equal(values['referrer-policy'], 'no-referrer');
  }
  for (const query of ['', '?v=synthetic']) {
    for (const file of assets) {
      assert.equal(
        pagesHeadersFor(outDir, `/${file}${query}`)['cache-control'],
        'public, max-age=31536000, immutable',
      );
    }
    for (const path of [
      '/assets/missing.js',
      '/assets/missing-abcdefgh.js',
      '/ordinary/fallback',
    ]) {
      assert.equal(
        pagesHeadersFor(outDir, `${path}${query}`)['cache-control'],
        'public, max-age=0, must-revalidate',
      );
    }
  }
  console.log(
    `${label}: reviewed static inventory (${files.length} entries), disjoint cache directives, and resolved CSP. Actual Pages responses remain a publication check.`,
  );
}
