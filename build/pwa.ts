import { VitePWA, type VitePWAOptions, type VitePluginPWAAPI } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

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

export function pwaPlugins(): Plugin[] {
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
          async (entries) => ({
            manifest: await Promise.all(
              entries.map(async (entry) => ({
                ...entry,
                integrity:
                  'sha256-' +
                  createHash('sha256')
                    .update(await readFile(resolve(directory, entry.url)))
                    .digest('base64'),
              })),
            ),
            warnings: [],
          }),
        ],
      },
    }),
  ];
}
