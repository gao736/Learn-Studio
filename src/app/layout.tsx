import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Learning Studio · 一步一步，真正学会',
  description: '从一节有来源、有练习、有记录的课程开始。',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">跳到主要内容</a>{children}</body></html>;
}
