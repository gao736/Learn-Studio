import Link from 'next/link';
import { AuthForm } from './AuthForm';
export function AuthPage({ mode, token }: { mode: 'register' | 'login' | 'forgot' | 'reset'; token?: string }) {
  return <div className="auth-wrap"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">L</span>Learning Studio</Link><main id="main" tabIndex={-1} className="auth-grid"><div className="auth-intro"><p className="eyebrow">A LITTLE EVERY DAY</p><h1>把好奇心，<br />变成你的知识。</h1><p>从一个具体问题开始。读懂它，试着回答，再留下可以继续的学习记录。</p><div className="meta-row"><span>有依据的讲解</span><span>独立练习</span><span>保存进度</span></div></div><AuthForm mode={mode} token={token} localMail={process.env.LOCAL_MAILBOX === 'true'} /></main></div>;
}
