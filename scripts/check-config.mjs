import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SYNTHETIC_ENV } from '../test/config.ts';
import { unsafeOrigins } from '../test/unsafeOrigins.ts';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const args of [['build'], ['--port', '5173']]) {
  const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', ...args], {
    env: {
      ...process.env,
      ...SYNTHETIC_ENV,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-invalid-value-do-not-echo',
    },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(result.status, 1, 'Invalid configuration must stop startup/build');
  const output = result.stdout + result.stderr;
  assert.match(output, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(output, /synthetic-invalid-value-do-not-echo/);
}
console.log('Invalid startup/build configuration rejected without exposing values.');

const mismatch = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  env: { ...process.env, ...SYNTHETIC_ENV, CF_PAGES: '1', npm_config_user_agent: 'pnpm/0.0.0' },
  encoding: 'utf8',
  timeout: 10_000,
});
assert.equal(mismatch.status, 1, 'Pages must reject a mismatched toolchain');
assert.match(
  mismatch.stdout + mismatch.stderr,
  /Pages builds require Node 24.21.0 and pnpm 10.27.0/,
);
console.log('Pages toolchain mismatch rejected.');

const extra = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  env: { ...process.env, ...SYNTHETIC_ENV, VITE_UNEXPECTED: 'synthetic-private-do-not-echo' },
  encoding: 'utf8',
  timeout: 10_000,
});
assert.equal(extra.status, 1, 'Unexpected VITE inputs must stop the build');
assert.match(
  extra.stdout + extra.stderr,
  /Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/,
);
assert.doesNotMatch(extra.stdout + extra.stderr, /synthetic-private-do-not-echo/);
console.log('Unexpected public inputs rejected without exposing values.');

// Invalid inputs must stop Vite before output/header generation, not merely fail
// a parser in isolation. Each rejected build has a fresh, absent output directory.
const root = mkdtempSync(join(tmpdir(), 'spendspacey-invalid-build-'));
let count = 0;
function rejects(env, expected) {
  const outDir = join(root, `case-${count++}`);
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir],
    {
      env: { ...process.env, ...SYNTHETIC_ENV, ...env },
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, expected);
  assert(!existsSync(outDir), 'Invalid build must not emit assets or connect-src');
}
// OS environment strings cannot contain NUL; parser/header unit tests cover it.
for (const value of unsafeOrigins.filter((value) => !value.includes('\0'))) {
  rejects({ VITE_SUPABASE_URL: value }, /VITE_SUPABASE_URL/);
}
for (const branch of ['main', 'feature', '']) {
  for (const value of [
    '',
    'https://*',
    'https://pages.dev',
    'https://a.b.c.pages.dev',
    'https://app.pages.dev?',
  ]) {
    rejects({ CF_PAGES: '1', CF_PAGES_BRANCH: branch, CF_PAGES_URL: value }, /valid CF_PAGES_URL/);
  }
}
console.log(`${count} unsafe URL/Pages metadata builds rejected before emitting headers.`);
