import { build } from 'vite';
import { SYNTHETIC_ENV } from '../test/config.ts';
// Two complete synthetic builds, using the actual production worker pipeline.
Object.assign(process.env, SYNTHETIC_ENV);
for (const key of ['CF_PAGES', 'CF_PAGES_BRANCH', 'CF_PAGES_URL']) delete process.env[key];
for (const version of ['v1', 'v2']) {
  await build({
    mode: 'development',
    build: { outDir: `.cache/installable-offline-shell/${version}` },
    plugins: [
      {
        name: 'synthetic-version-marker',
        transform(code, id) {
          if (id.endsWith('/src/main.tsx'))
            return code + `\ndocument.documentElement.dataset.syntheticVersion = '${version}';`;
        },
      },
    ],
  });
}

// Build the actual reviewed predecessor, not a hand-authored approximation of
// its metadata. Full CI history supplies this immutable revision; no checkout,
// settings change or live account is involved.
const { execFileSync } = await import('node:child_process');
const { mkdtempSync, symlinkSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { resolve, join } = await import('node:path');
for (const [revision, label] of [
  ['069dbc50f4a34b76fefd2a3eb934388d452a8b5a', 'legacy-069dbc50'],
  ['611994f4e0cae15b4b4ef4ada6659d10ac059a55', 'baseline-611994f'],
  ['fabde5f3e7c35bae4dcf6b5fc8981e2d7f74a940', 'before-startup-fabde5f'],
]) {
  const legacyRoot = mkdtempSync(join(tmpdir(), 'spendspacey-version-'));
  try {
    const archive = execFileSync('git', ['archive', revision], {
      maxBuffer: 16 * 1024 * 1024,
    });
    execFileSync('tar', ['-x', '-C', legacyRoot], { input: archive });
    symlinkSync(resolve('node_modules'), join(legacyRoot, 'node_modules'), 'dir');
    await build({
      root: legacyRoot,
      configFile: join(legacyRoot, 'vite.config.ts'),
      mode: 'development',
      build: {
        outDir: resolve('.cache/installable-offline-shell/' + label),
        emptyOutDir: true,
      },
      plugins: [
        {
          name: 'synthetic-legacy-version-marker',
          transform(code, id) {
            if (id.endsWith('/src/main.tsx'))
              return (
                code +
                `\ndocument.documentElement.dataset.syntheticVersion=${JSON.stringify(label)};`
              );
          },
        },
      ],
    });
  } finally {
    rmSync(legacyRoot, { recursive: true, force: true });
  }
}
