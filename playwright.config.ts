import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
if (process.env.LOCAL_MAILBOX !== 'true' || process.env.SMTP_HOST !== '127.0.0.1') {
  throw new Error('自动浏览器验收使用本机测试邮件。请先启动使用本机邮件配置的网站，真实SMTP需单独人工验收。');
}
const baseURL = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000';
const mailMode = await fetch(new URL('/api/auth/mail-mode', baseURL), { signal: AbortSignal.timeout(5000), cache: 'no-store' });
if (!mailMode.ok || (await mailMode.json()).localMail !== true) {
  throw new Error('被测网站必须使用本机测试邮件。当前服务模式未确认或使用真实SMTP，已阻止自动验收。');
}
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 60000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium', channel: 'msedge',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
