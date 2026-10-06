import Link from 'next/link';
export default function Home() {
  return <main id="main" tabIndex={-1} className="welcome"><p className="eyebrow">LEARNING STUDIO</p><h1>从一个问题，<br />开始认识世界。</h1><p>用一节天文学课程，体验讲解、独立练习和学习记录。</p><Link className="button" href="/register">开始学习</Link><Link className="text-link" href="/login">已有账户，继续学习</Link></main>;
}
