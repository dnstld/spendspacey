import { VitePWA, type VitePWAOptions, type VitePluginPWAAPI } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { mimeFor } from '../worker/policy.ts';
import { canonical } from '../worker/schema.ts';

export const pwaOptions: Partial<VitePWAOptions> = {
  strategies: 'injectManifest',
  srcDir: 'worker',
  filename: 'sw.ts',
  injectRegister: false,
  registerType: 'prompt',
  includeAssets: [],
  includeManifestIcons: false,
  manifest: {
    id: '/',
    name: 'Spendspacey',
    short_name: 'Spendspacey',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#f6f7f2',
    background_color: '#f6f7f2',
    prefer_related_applications: false,
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  injectManifest: {
    // No unrestricted public-directory glob. Every JS/CSS output is required,
    // including the lazily imported Auth SDK; build checks audit the final set.
    globPatterns: [
      'index.html',
      'assets/*-*.js',
      'assets/*-*.css',
      'fonts/google-sans-medium.woff2',
      'google-g.png',
      'manifest.webmanifest',
      'icons/app-192.png',
      'icons/app-512.png',
      'icons/maskable-512.png',
      'icons/apple-touch-icon.png',
    ],
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
    rollupFormat: 'iife',
  },
};

export function pwaPlugins(policy: unknown, config: unknown): Plugin[] {
  const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const compatibility = hash(
    JSON.stringify({
      routing: 2,
      offlineResponse: 2,
      authPolicy: policy,
      configuration: hash(JSON.stringify(config)),
      scope: '/',
    }),
  );
  let directory = '';
  let api: VitePluginPWAAPI;
  return [
    {
      name: 'spendspacey-pwa-integrity',
      configResolved(config) {
        directory = resolve(config.root, config.build.outDir);
        api = config.plugins.find((plugin) => plugin.name === 'vite-plugin-pwa')!
          .api as VitePluginPWAAPI;
      },
      buildStart() {
        // The reviewed glob includes the manifest and supplies its integrity.
        // Suppress the plugin's duplicate, untransformed additional entry.
        api.extendManifestEntries(() => []);
      },
    },
    ...VitePWA({
      ...pwaOptions,
      injectManifest: {
        ...pwaOptions.injectManifest,
        manifestTransforms: [
          async (entries) => {
            const manifest = await Promise.all(
              entries.map(async (entry) => {
                const bytes = await readFile(resolve(directory, entry.url));
                const url = entry.url === 'index.html' ? '/' : '/' + entry.url;
                return {
                  url,
                  key: url,
                  revision: entry.revision,
                  integrity: 'sha256-' + createHash('sha256').update(bytes).digest('base64'),
                  type: mimeFor(url),
                  bytes: bytes.length,
                };
              }),
            );
            manifest.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
            // Include compiled worker implementation identity without a circular
            // self-hash: this is the pre-injection bundle containing its placeholder.
            const implementation = hash(await readFile(resolve(directory, 'sw.js')));
            const worker = hash(canonical({ entries: manifest, compatibility, implementation }));
            return {
              manifest: manifest.map((entry) => ({
                ...entry,
                worker,
                implementation,
                compatibility,
                size: entry.bytes,
              })),
              warnings: [],
            };
          },
        ],
      },
    }),
  ];
}
