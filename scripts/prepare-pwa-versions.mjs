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
