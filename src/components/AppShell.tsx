import Link from 'next/link';
import { Logout } from '@/features/auth/Logout';
const items = [
  { href: '/today', label: '今天', path: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z' },
  { href: '/lesson/astronomy', label: '课堂', path: 'M12 5c-4-3-8-2-9-1v15c3-2 6-2 9 0 3-2 6-2 9 0V4c-1-1-5-2-9 1Zm0 0v14' },
  { href: '/courses', label: '课程', path: 'M4 3h16v18H4Zm4 5h8M8 12h8M8 16h5' },
  { href: '/reviews', label: '复习', path: 'M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2' },
  { href: '/assessments', label: '能力诊断', path: 'M4 4h16v16H4Zm4 5 2 2 5-5M8 16h8' },
];
export function AppShell({ user, active, children }: { user: { name: string; email: string }; active: string; children: React.ReactNode }) {
  return <div className="shell"><aside className="sidebar"><Link className="brand" href="/today"><span className="brand-mark" aria-hidden="true">L</span>Learning Studio</Link><nav className="nav" aria-label="主要导航">{items.map(item => <Link key={item.href} href={item.href} className={active === item.href ? 'active' : ''} aria-current={active === item.href ? 'page' : undefined}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d={item.path} /></svg>{item.label}</Link>)}</nav><div className="sidebar-footer"><p className="user-name">{user.name}</p><p className="note">本机开发版</p><Logout /></div></aside><main id="main" tabIndex={-1} className="page">{children}</main></div>;
}
