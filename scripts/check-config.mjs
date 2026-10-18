import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SYNTHETIC_ENV } from '../test/config.ts';

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
