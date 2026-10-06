'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" tabIndex={-1} className="error-screen"><p className="eyebrow">PLEASE TRY AGAIN</p><h1>暂时无法打开这个页面。</h1><p className="muted">已有学习记录仍保存在数据库中。请检查本机数据库是否运行，再重试。</p><button className="button" onClick={reset}>重新尝试</button></main>;
}
