import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/preview.spec.ts',
      metadata: { buildDir: 'dist' },
      use: { ...devices['Desktop Chrome'] },
    },
    ...['preview', 'unclassified'].map((kind, index) => ({
      name: `chromium-pages-${kind}`,
      testMatch: '**/preview.spec.ts',
      metadata: { buildDir: `.cache/deploy-auth-shell/${kind}` },
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${4174 + index}` },
    })),
  ],
  webServer: [
    {
      command: 'node scripts/with-test-env.mjs preview --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
    ...['preview', 'unclassified'].map((kind, index) => ({
      command: `node scripts/with-test-env.mjs preview --outDir .cache/deploy-auth-shell/${kind} --host 127.0.0.1 --port ${4174 + index} --strictPort`,
      url: `http://127.0.0.1:${4174 + index}`,
      reuseExistingServer: false,
    })),
  ],
});
