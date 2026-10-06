import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 60000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: {
    baseURL: process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000',
    browserName: 'chromium', channel: 'msedge',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
