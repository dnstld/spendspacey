import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type { AuthenticationPolicy } from '../src/lib/deployment.ts';
import { httpsDnsOrigin, supabaseOrigin } from '../src/lib/origin.ts';

export function pagesPolicy(env: NodeJS.ProcessEnv, local: boolean): AuthenticationPolicy {
  if (env.CF_PAGES !== '1') return { kind: local ? 'local' : 'denied' };
  let origin: string;
  try {
    const url = new URL(httpsDnsOrigin(env.CF_PAGES_URL));
    const labels = url.hostname.split('.');
    if (![3, 4].includes(labels.length) || labels.slice(-2).join('.') !== 'pages.dev')
      throw new Error();
    origin = `https://${labels.slice(-3).join('.')}`;
  } catch {
    throw new Error('Pages builds require a valid CF_PAGES_URL on the assigned pages.dev host.');
  }
  return env.CF_PAGES_BRANCH === 'main' ? { kind: 'production', origin } : { kind: 'denied' };
}

export function verifyPagesToolchain(env: NodeJS.ProcessEnv) {
  if (env.CF_PAGES !== '1') return;
  const pnpm = env.npm_config_user_agent?.split(' ')[0];
  if (process.versions.node !== '24.21.0' || pnpm !== 'pnpm/10.27.0') {
    throw new Error('Pages builds require Node 24.21.0 and pnpm 10.27.0.');
  }
  console.info('Pages build toolchain: Node 24.21.0; pnpm 10.27.0.');
}

export function validateHeaderLimits(source: string) {
  const lines = source.split('\n');
  const rules = lines.filter((line) => line && !/^[\s#]/.test(line)).length;
  if (rules > 100 || lines.some((line) => line.length > 2000)) {
    throw new Error('Pages headers exceed the 100-rule or 2,000-character line limit.');
  }
}

export function renderPagesHeaders(
  template: string,
  origin: string,
  assets: string[],
  local = false,
) {
  const validatedOrigin = supabaseOrigin(origin, local);
  if (template.split('__SUPABASE_ORIGIN__').length !== 2) {
    throw new Error('Pages header template must contain exactly one origin marker.');
  }
  const rules = [...new Set(assets)].sort().map((path) => {
    if (!/^assets\/[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9]+$/.test(path)) {
      throw new Error('Immutable asset must have a safe fingerprinted output path.');
    }
    return `/${path}\n  Cache-Control: public, max-age=31536000, immutable\n`;
  });
  const source = template.replace('__SUPABASE_ORIGIN__', validatedOrigin) + '\n' + rules.join('\n');
  validateHeaderLimits(source);
  return source;
}

// Build time only. The emitted bundle, not a public-directory glob, owns this list.
export function pagesHeaders(origin: string, local: boolean): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'spendspacey-pages-headers',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async writeBundle(_options, bundle) {
      const assets: string[] = [];
      for (const entry of Object.values(bundle)) {
        if (!entry.fileName.startsWith('assets/')) continue;
        const bytes = await readFile(resolve(config.root, config.build.outDir, entry.fileName));
        const emitted = entry.type === 'chunk' ? entry.code : entry.source;
        if (!bytes.equals(Buffer.from(emitted)))
          throw new Error('Emitted asset inventory mismatch.');
        assets.push(entry.fileName);
      }
      const path = resolve(config.root, config.build.outDir, '_headers');
      await writeFile(
        path,
        renderPagesHeaders(await readFile(path, 'utf8'), origin, assets, local),
      );
    },
  };
}
