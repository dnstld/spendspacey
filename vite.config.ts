import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { parsePublicConfig } from './src/lib/env.ts';
import { pagesHeaders, pagesPreview, verifyPagesToolchain } from './build/pages.ts';

export default defineConfig(({ mode }) => {
  const config = parsePublicConfig(loadEnv(mode, process.cwd(), 'VITE_'));
  verifyPagesToolchain(process.env);
  return {
    plugins: [react(), tailwindcss(), pagesHeaders(config.supabaseUrl)],
    // Only this boolean crosses the build boundary, never the Pages environment.
    define: { __PAGES_PREVIEW__: JSON.stringify(pagesPreview(process.env)) },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { host: 'localhost', port: 5173, strictPort: true },
  };
});
