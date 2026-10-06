import { betterAuth } from 'better-auth';
import nodemailer from 'nodemailer';
import { pool } from './db.ts';

const baseURL = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000';
const localMail = process.env.LOCAL_MAILBOX === 'true';
if (localMail && (new URL(baseURL).hostname !== '127.0.0.1' || process.env.SMTP_HOST !== '127.0.0.1')) {
  throw new Error('本机测试邮件配置不能用于公开网站。');
}
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', ignoreTLS: localMail, requireTLS: !localMail,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
});
async function sendEmail(to: string, subject: string, text: string) {
  await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, text, encoding: 'base64' });
}
export const auth = betterAuth({
  database: pool, baseURL, secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendEmail(user.email, '重置 Learning Studio 密码', `请使用以下链接重置密码：\n${url}\n如果不是你本人申请，请忽略此邮件。`),
  },
  emailVerification: {
    sendOnSignUp: true, autoSignInAfterVerification: true, expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => sendEmail(user.email, '验证 Learning Studio 邮箱', `请使用以下链接验证邮箱：\n${url}\n链接一小时内有效。如果不是你本人注册，请忽略此邮件。`),
  },
  session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true, storage: 'database', window: 60, max: 100,
    customRules: {
      '/sign-up/email': { window: 60, max: 10 },
      '/sign-in/email': { window: 60, max: 20 },
      '/request-password-reset': { window: 60, max: 5 },
      '/send-verification-email': { window: 60, max: 5 },
    },
  },
});
