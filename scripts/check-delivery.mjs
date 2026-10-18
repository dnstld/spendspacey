import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYNTHETIC_ENV } from '../test/config.ts';
import { pagesHeadersFor } from '../test/pagesHeaders.ts';

// Compile real Pages variants. Browser tests subsequently exercise these exact files.
for (const [label, branch, outDir] of [
  ['production', 'main', 'dist'],
  ['preview', 'feat/synthetic-preview', '.cache/deploy-auth-shell/preview'],
  ['unclassified', undefined, '.cache/deploy-auth-shell/unclassified'],
]) {
  const env = { ...process.env, ...SYNTHETIC_ENV, CF_PAGES: '1' };
  delete env.CF_PAGES_BRANCH;
  if (branch) env.CF_PAGES_BRANCH = branch;
  console.log(`Checking synthetic Pages ${label} build.`);
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir],
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
  assert(!headers.includes('__SUPABASE_ORIGIN__'));
  assert(headers.includes(`connect-src 'self' ${SYNTHETIC_ENV.VITE_SUPABASE_URL};`));
  assert(!headers.includes(SYNTHETIC_ENV.VITE_SUPABASE_PUBLISHABLE_KEY));
  for (const path of ['/', '/index.html', '/google-g.png', '/fonts/google-sans-medium.woff2']) {
    assert.equal(pagesHeadersFor(outDir, path)['cache-control'], 'no-cache');
  }
  for (const path of ['/auth/callback', '/auth/callback?code=synthetic-code']) {
    const values = pagesHeadersFor(outDir, new URL(path, 'https://app.example.test').pathname);
    assert.equal(values['cache-control'], 'no-store');
    assert.equal(values['referrer-policy'], 'no-referrer');
  }
  for (const file of files.filter(
    (path) => path.startsWith('assets/') && /\.(js|css)$/.test(path),
  )) {
    assert.equal(
      pagesHeadersFor(outDir, `/${file}`)['cache-control'],
      'public, max-age=31536000, immutable',
    );
  }
  console.log(
    `${label}: reviewed static inventory (${files.length} entries), disjoint cache directives, and resolved CSP. Actual Pages responses remain a publication check.`,
  );
}
