import { spawnSync } from 'node:child_process';
import { delimiter, dirname } from 'node:path';
import { SYNTHETIC_ENV } from '../test/config.ts';

const result = spawnSync('pnpm', process.argv.slice(2), {
  env: {
    ...process.env,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`,
    ...SYNTHETIC_ENV,
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
