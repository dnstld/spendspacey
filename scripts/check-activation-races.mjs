import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const repetitions = 10;
for (const constrained of [false, true]) {
  for (let round = 1; round <= repetitions; round++) {
    console.log(
      `Activation interruption/concurrency matrix: ${constrained ? 'constrained' : 'ordinary'} ${round}/${repetitions}`,
    );
    const result = spawnSync(
      process.execPath,
      [
        'scripts/with-test-env.mjs',
        'exec',
        'vitest',
        'run',
        'src/pwa/activation.test.ts',
        'src/pwa/startup.test.ts',
        ...(constrained ? ['--maxWorkers=1'] : []),
      ],
      {
        env: { ...process.env, ...(constrained ? { UV_THREADPOOL_SIZE: '1' } : {}) },
        stdio: 'inherit',
      },
    );
    assert.equal(result.status, 0, 'Activation matrix failed; no retries');
  }
}
