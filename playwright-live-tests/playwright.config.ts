import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'always' }]],
  timeout: 30000,
  use: {
    baseURL: 'http://10.10.10.141',
    headless: false,
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    launchOptions: {
      slowMo: 800,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { channel: 'chromium' },
    },
  ],
});
