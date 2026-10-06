import Link from 'next/link';
export default function NotFound() { return <main id="main" tabIndex={-1} className="error-screen"><h1>没有找到这条内容。</h1><p className="muted">记录可能不存在，或不属于当前账户。</p><Link className="button" href="/today">回到今天</Link></main>; }
