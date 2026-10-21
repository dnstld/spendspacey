import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const repetitions = process.env.REPAIR_RACE_REPETITIONS ?? '10';
assert(/^[1-9]\d?$|^100$/.test(repetitions), 'Invalid repair race repetition count');
console.log(
  `Repair ordering matrix: ${repetitions} repetitions each, ordinary and constrained scheduling.`,
);
const result = spawnSync(
  process.execPath,
  [
    'scripts/with-test-env.mjs',
    'exec',
    'vitest',
    'run',
    'src/pwa/repairOutcome.test.ts',
    '--reporter=verbose',
  ],
  { env: { ...process.env, REPAIR_RACE_REPETITIONS: repetitions }, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
