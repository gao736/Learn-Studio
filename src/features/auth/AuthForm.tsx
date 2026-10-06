'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from './client';

type Mode = 'register' | 'login' | 'forgot' | 'reset';
const labels = {
  register: ['创建你的学习账户', '从第一节课开始，留下每一步学习记录。', '创建账户'],
  login: ['欢迎回来', '登录后，继续上次的学习。', '登录并继续'],
  forgot: ['找回密码', '我们会向你的邮箱发送重置链接。', '发送重置邮件'],
  reset: ['设置新密码', '请使用至少 12 个字符的新密码。', '保存新密码'],
};
export function AuthForm({ mode, localMail, token }: { mode: Mode; localMail: boolean; token?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(''); setSuccess(''); setNeedsVerification(false);
    const data = new FormData(event.currentTarget);
    const emailValue = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    setEmail(emailValue);
    try {
      const response = mode === 'register'
        ? await authClient.signUp.email({ name: String(data.get('name') || '').trim(), email: emailValue, password, callbackURL: '/today' })
        : mode === 'login'
          ? await authClient.signIn.email({ email: emailValue, password, callbackURL: '/today' })
          : mode === 'forgot'
            ? await authClient.requestPasswordReset({ email: emailValue, redirectTo: '/reset-password' })
            : await authClient.resetPassword({ newPassword: password, token: token || '' });
      if (response.error) {
        const code = response.error.code;
        setNeedsVerification(mode === 'login' && code === 'EMAIL_NOT_VERIFIED');
        setError(code === 'EMAIL_NOT_VERIFIED' ? '请先完成邮箱验证，再登录。'
          : code === 'INVALID_EMAIL_OR_PASSWORD' ? '邮箱或密码不正确，请检查后重试。'
          : code?.includes('USER_ALREADY_EXISTS') ? '此邮箱已注册，可以登录或找回密码。'
          : response.error.status === 429 ? '请求较频繁，请稍后再试。'
          : '暂时无法完成请求，请检查输入或稍后重试。');
        return;
      }
      if (mode === 'register') setSuccess('注册请求已受理。请查看验证邮件；已有账户可登录或重新发送验证邮件。');
      else if (mode === 'forgot') setSuccess('如果这个邮箱已注册，你将收到密码重置邮件。');
      else if (mode === 'reset') setSuccess('密码已更新，请使用新密码登录。');
      else window.location.assign('/today');
    } catch { setError('连接暂时不可用，请稍后重试。'); }
    finally { setPending(false); }
  }
  async function resend() {
    if (!email || pending) return;
    setPending(true); setError('');
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: '/today' });
      if (result.error) setError('邮件暂时无法发送，请稍后重试。');
      else setSuccess('验证邮件请求已受理，请检查邮箱。');
    } catch { setError('连接暂时不可用，请稍后重试。'); }
    finally { setPending(false); }
  }
  const [title, description, button] = labels[mode];
  return <section className="auth-form" aria-labelledby="auth-title">
    <h2 id="auth-title">{title}</h2><p className="muted">{description}</p>
    {error && <div className="alert" role="alert">{error}</div>}
    {success && <div className="alert success" role="status">{success}{mode === 'register' && <p className="note" style={{ margin: '8px 0 0' }}>验证后就可以开始学习。请打开邮件中的链接。</p>}</div>}
    {(!success || mode === 'login') && <form onSubmit={submit}>
      {mode === 'register' && <><label className="field" htmlFor="name">称呼</label><input id="name" name="name" autoComplete="name" required minLength={1} maxLength={80} /></>}
      {mode !== 'reset' && <><label className="field" htmlFor="email">邮箱</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder={localMail ? 'yourname@example.test' : 'name@example.com'} /></>}
      {mode !== 'forgot' && <><label className="field" htmlFor="password">密码</label><input id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={12} maxLength={128} aria-describedby="password-help" /><p className="note" id="password-help" style={{ margin: '8px 0 0' }}>至少 12 个字符，可使用一段容易记住的短句。</p></>}
      <button className="button" disabled={pending || (mode === 'reset' && !token)}>{pending ? '正在提交…' : button}</button>
      {mode === 'reset' && !token && <p className="alert">重置链接缺少凭证，请重新申请。</p>}
    </form>}
    {((mode === 'register' && success) || needsVerification) && <button className="button secondary" onClick={resend} disabled={pending}>{pending ? '正在发送…' : '重新发送验证邮件'}</button>}
    <div className="auth-links"><Link className="text-link" href={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? '已有账户，登录' : '创建账户'}</Link>{mode === 'login' ? <Link className="text-link" href="/forgot-password">忘记密码</Link> : <Link className="text-link" href="/login">返回登录</Link>}</div>
    {localMail && <p className="auth-note">本机测试模式：请使用 example.test 邮箱。验证邮件保存在项目的 .runtime/mail，使用 README 中的命令读取；不会发到互联网。</p>}
  </section>;
}
