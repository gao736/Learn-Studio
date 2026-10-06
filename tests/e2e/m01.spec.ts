import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const password = 'Local-test-passphrase-82!';
async function mailLink(email: string, kind: string) {
  for (let retry = 0; retry < 60; retry++) {
    const files = await readdir('.runtime/mail').catch(() => []);
    for (const file of files.sort().reverse()) {
      const mail = JSON.parse(await readFile(path.join('.runtime/mail', file), 'utf8'));
      if (mail.to.includes(email) && mail.text.includes(kind)) {
        return mail.text.match(/http:\/\/127\.0\.0\.1:3000\/[^\s<>]+/)[0];
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local SMTP did not deliver the expected verification/reset message');
}

test('M01: verified account, saved quiz, login persistence and cross-user isolation', async ({ page, browser }) => {
  const email = `learner-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('称呼').fill('星空学习者');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('status')).toContainText('注册请求已受理');

  // A real, unverified user must be blocked even with valid credentials.
  const unverified = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password }, headers: { Origin: 'http://127.0.0.1:3000' },
  });
  expect(unverified.status()).toBe(403);
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.locator('.auth-form').getByRole('alert')).toHaveText('请先完成邮箱验证，再登录。');
  await page.getByRole('button', { name: '重新发送验证邮件' }).click();
  await expect(page.getByRole('status')).toContainText('验证邮件请求已受理');
  await page.goto(await mailLink(email, 'verify-email'));
  await expect(page.getByRole('heading', { name: '今天，认识我们的星空。' })).toBeVisible();
  await page.getByRole('link', { name: '开始这节课' }).click();
  await expect(page.getByRole('heading', { name: '恒星、行星与卫星' })).toBeVisible();
  const quiz = page.locator('#quiz');
  for (const [index, choice] of [1, 0, 2, 1, 0].entries()) {
    await quiz.locator(`input[name="q${index + 1}"][value="${choice}"]`).check();
  }
  await page.getByRole('button', { name: '提交并保存结果' }).click();
  await expect(page.getByText('5 / 5', { exact: true })).toBeVisible();
  const attemptId = page.url().split('/').at(-1)!;
  await page.reload();
  await expect(page.getByText('5 / 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.getByText('上次答题：5 / 5')).toBeVisible();

  // Querying another user's exact attempt ID is denied, not merely hidden in the UI.
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const otherEmail = `other-${Date.now()}@example.test`;
  await other.request.post('/api/auth/sign-up/email', {
    data: { name: '另一位学习者', email: otherEmail, password, callbackURL: '/today' },
    headers: { Origin: 'http://127.0.0.1:3000' },
  });
  await other.request.get(await mailLink(otherEmail, 'verify-email'));
  const foreignAttempt = await other.request.get(`/api/attempts/${attemptId}`);
  expect(foreignAttempt.status()).toBe(404);
  const otherPage = await other.newPage();
  await otherPage.goto('/today');
  await expect(otherPage.getByText('还没有答题记录')).toBeVisible();
  await other.close();

  // One real learning flow is checked at all prescribed widths.
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/lesson/astronomy');
    await expect(page.getByRole('button', { name: '提交并保存结果' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.runtime/m01-${width}.png`, fullPage: true });
  }
  await page.goto('/today');
  await page.screenshot({ path: '.runtime/today-desktop.png', fullPage: true });
  // Changing accounts in the same browser must discard the former account's UI cache.
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByLabel('邮箱').fill(otherEmail);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.getByText('还没有答题记录')).toBeVisible();
  expect((await page.request.get(`/api/attempts/${attemptId}`)).status()).toBe(404);
});

test('mobile quiz keeps answers during a real database write failure and saves on retry', async ({ page }) => {
  const databaseURL = new URL(process.env.DATABASE_URL!);
  if (databaseURL.hostname !== '127.0.0.1' || databaseURL.port !== '54329'
      || databaseURL.username !== 'learning_app' || databaseURL.pathname !== '/learning_platform'
      || process.env.LOCAL_MAILBOX !== 'true') {
    throw new Error('Failure injection is permitted only in the dedicated local database.');
  }
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = `mobile-${Date.now()}@example.test`;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/register');
  await page.getByLabel('称呼').fill('手机学习者');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.goto(await mailLink(email, 'verify-email'));
  await page.getByRole('link', { name: '开始这节课' }).click();
  const choices = [0, 1, 0, 0, 1];
  for (const [index, choice] of choices.entries()) {
    await page.locator(`input[name="q${index + 1}"][value="${choice}"]`).check();
  }
  try {
    // Tighten permissions temporarily; don't mock the Server Action or disable RLS.
    await database.query('REVOKE INSERT ON lesson_attempts FROM CURRENT_USER');
    await page.getByRole('button', { name: '提交并保存结果' }).click();
    await expect(page.locator('#quiz').getByRole('alert')).toContainText('结果暂时无法保存');
    for (const [index, choice] of choices.entries()) {
      await expect(page.locator(`input[name="q${index + 1}"][value="${choice}"]`)).toBeChecked();
    }
  } finally {
    await database.query('GRANT INSERT ON lesson_attempts TO CURRENT_USER');
    await database.end();
  }
  await page.getByRole('button', { name: '提交并保存结果' }).click();
  await expect(page.getByText('0 / 5', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '今天', exact: true }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.getByText('上次答题：0 / 5')).toBeVisible();
  await page.screenshot({ path: '.runtime/today-mobile.png', fullPage: true });
});

test('password reset delivers a real local email, invalidates old sessions and changes credentials', async ({ page, browser }) => {
  const email = `reset-${Date.now()}@example.test`;
  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: '密码恢复学习者', email, password, callbackURL: '/today' },
    headers: { Origin: 'http://127.0.0.1:3000' },
  });
  expect(signup.status()).toBe(200);
  await page.goto(await mailLink(email, 'verify-email'));
  await expect(page.getByRole('heading', { name: '今天，认识我们的星空。' })).toBeVisible();
  const recovery = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const recoveryPage = await recovery.newPage();
  await recoveryPage.goto('/forgot-password');
  await recoveryPage.getByLabel('邮箱').fill(email);
  await recoveryPage.getByRole('button', { name: '发送重置邮件' }).click();
  await expect(recoveryPage.getByRole('status')).toContainText('你将收到密码重置邮件');
  await recoveryPage.goto(await mailLink(email, 'reset-password'));
  const newPassword = 'New-local-passphrase-92!';
  await recoveryPage.getByLabel('密码', { exact: true }).fill(newPassword);
  await recoveryPage.getByRole('button', { name: '保存新密码' }).click();
  await expect(recoveryPage.getByRole('status')).toContainText('密码已更新');
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login/);
  await recoveryPage.getByRole('link', { name: '返回登录' }).click();
  await recoveryPage.getByLabel('邮箱').fill(email);
  await recoveryPage.getByLabel('密码', { exact: true }).fill(password);
  await recoveryPage.getByRole('button', { name: '登录并继续' }).click();
  await expect(recoveryPage.locator('.auth-form').getByRole('alert')).toHaveText('邮箱或密码不正确，请检查后重试。');
  await recoveryPage.getByLabel('密码', { exact: true }).fill(newPassword);
  await recoveryPage.getByRole('button', { name: '登录并继续' }).click();
  await expect(recoveryPage.getByRole('heading', { name: '今天，认识我们的星空。' })).toBeVisible();
  await recovery.close();
});

test('protected results reject an anonymous request and registration has usable keyboard focus', async ({ page }) => {
  const response = await page.request.get('/api/attempts/00000000-0000-4000-8000-000000000000');
  expect(response.status()).toBe(401);
  await page.goto('/register');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
