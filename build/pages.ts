import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export function pagesPreview(env: NodeJS.ProcessEnv): boolean {
  return env.CF_PAGES === '1' && env.CF_PAGES_BRANCH !== 'main';
}

export function verifyPagesToolchain(env: NodeJS.ProcessEnv) {
  if (env.CF_PAGES !== '1') return;
  const pnpm = env.npm_config_user_agent?.split(' ')[0];
  if (process.versions.node !== '24.21.0' || pnpm !== 'pnpm/10.27.0') {
    throw new Error('Pages builds require Node 24.21.0 and pnpm 10.27.0.');
  }
  console.info('Pages build toolchain: Node 24.21.0; pnpm 10.27.0.');
}

// This runs only at build time. Pages receives static assets, never runtime code.
export function pagesHeaders(supabaseOrigin: string): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'spendspacey-pages-headers',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async writeBundle() {
      const path = resolve(config.root, config.build.outDir, '_headers');
      const template = await readFile(path, 'utf8');
      if (template.split('__SUPABASE_ORIGIN__').length !== 2) {
        throw new Error('Pages header template must contain exactly one origin marker.');
      }
      await writeFile(path, template.replace('__SUPABASE_ORIGIN__', supabaseOrigin));
    },
  };
}
