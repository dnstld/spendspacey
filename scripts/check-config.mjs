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
