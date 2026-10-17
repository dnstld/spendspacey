import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const version = '8.30.1';
// Verified against the official release checksums. No remote install script is executed.
const checksums = {
  darwin_arm64: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
  darwin_x64: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  linux_arm64: 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  linux_x64: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
};
const platform = `${process.platform}_${process.arch}`;
assert(platform in checksums, 'Secret scanning supports macOS/Linux x64/arm64.');
const cache = resolve('.cache', 'gitleaks', version);
mkdirSync(cache, { recursive: true });
const archive = join(cache, `${platform}.tar.gz`);
if (!existsSync(archive)) {
  const response = await fetch(
    `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${platform}.tar.gz`,
    { signal: AbortSignal.timeout(60_000) },
  );
  assert(response.ok, `Gitleaks download failed (${response.status})`);
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
}
assert.equal(
  createHash('sha256').update(readFileSync(archive)).digest('hex'),
  checksums[platform],
  'Gitleaks archive checksum mismatch',
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed`);
  return result;
}
run('tar', ['-xzf', archive, '-C', cache, 'gitleaks']);
const binary = join(cache, 'gitleaks');
const inventory = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
  stdio: 'pipe',
})
  .stdout.split('\0')
  .filter(Boolean);
const staging = mkdtempSync(join(tmpdir(), 'spendspacey-secret-scan-'));
try {
  // Scan the complete proposed file inventory, including untracked OpenSpec files.
  // Dependencies, ignored local configuration, and traces are not PR candidates.
  for (const path of inventory) {
    assert(lstatSync(path).isFile(), `Review non-file inventory entry before scanning: ${path}`);
    const target = join(staging, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(path, target, { dereference: false });
  }
  if (existsSync('dist')) cpSync('dist', join(staging, 'dist'), { recursive: true });
  run(binary, ['dir', staging, '--redact', '--no-banner']);
  run(binary, ['git', '.', '--log-opts=--all', '--redact', '--no-banner']);
  console.log(
    `Secret scan passed: ${inventory.length} repository candidate files, production build, and Git history.`,
  );
} finally {
  rmSync(staging, { recursive: true, force: true });
}
