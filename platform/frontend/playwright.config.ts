import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/visual',
  globalSetup: './tests/visual/global-setup.ts',
  outputDir: './test-results/visual',
  snapshotDir: './tests/visual/__screenshots__',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
  use: {
    baseURL,
    storageState: './tests/visual/.auth/admin.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  },
  projects: [
    {
      name: 'chromium-thehive-parity',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
