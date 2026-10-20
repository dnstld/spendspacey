import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { parsePublicConfig } from './src/lib/env.ts';
import { pagesHeaders, pagesPolicy, verifyPagesToolchain } from './build/pages.ts';
import { pwaPlugins } from './build/pwa.ts';

export default defineConfig(({ mode, command, isPreview }) => {
  verifyPagesToolchain(process.env);
  const policy = pagesPolicy(
    process.env,
    (command === 'serve' && !isPreview) || mode === 'development',
  );
  const local = policy.kind === 'local';
  const config = parsePublicConfig(loadEnv(mode, process.cwd(), 'VITE_'), local);
  return {
    plugins: [
      react(),
      tailwindcss(),
      pagesHeaders(config.supabaseUrl, local),
      ...pwaPlugins(policy, config),
    ],
    // Only validated generated policy crosses this boundary; no third VITE input.
    define: { __AUTH_POLICY__: JSON.stringify(policy) },
    build: {
      rolldownOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { host: 'localhost', port: 5173, strictPort: true },
  };
});
