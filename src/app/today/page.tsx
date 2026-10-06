import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { AstronomyArt } from '@/components/AstronomyArt';
import { requireUser } from '@/server/session';
import { latestAttempt } from '@/features/lesson/repository';

export default async function Today() {
  const user = await requireUser();
  const attempt = await latestAttempt(user.id);
  return <AppShell user={user} active="/today"><div className="topline"><span className="breadcrumb">你的学习空间</span><span className="status-badge">答题结果提交后保存</span></div><header className="page-heading"><p className="eyebrow">TODAY'S LEARNING</p><h1>今天，认识我们的星空。</h1><p>{user.name}，从一节课开始，理解夜空中看起来相似的天体。</p></header><div className="two-col"><section className="card course-card"><AstronomyArt /><div className="course-body"><span className="card-label">天文学入门 · 第 1 节</span><h2>恒星、行星与卫星</h2><p className="muted">太阳为什么发光？金星为什么也很亮？用三个概念，解释你看到的星空。</p><div className="meta-row"><span>讲解与练习</span><span>约 15 分钟</span><span>5 道独立练习</span></div><Link className="button" href="/lesson/astronomy">开始这节课 <span aria-hidden="true">→</span></Link></div></section><div className="side-stack"><section className="card"><span className="card-label">这节课之后，你可以</span><ul className="goal-list"><li>解释太阳发光的能量来源</li><li>区分恒星、行星和卫星</li><li>用反射光解释金星与月光</li></ul><p className="note">课程范围：基础概念。暂不包含轨道计算与天体物理推导。</p></section><section className="card"><span className="card-label">你的学习记录</span>{attempt ? <><p className="metric">{attempt.score} / {attempt.total}</p><p className="note">上次答题：{attempt.score} / {attempt.total}</p><Link className="text-link" href={`/results/${attempt.id}`}>查看保存的反馈</Link></> : <><p className="metric">从这里开始</p><p className="note">还没有答题记录</p></>}<p className="note">记录答题表现，尚不代表完整能力或长期掌握程度。</p></section></div></div><p className="note" style={{ marginTop: 28 }}>当前可体验：邮箱账户、示例课程和学习记录。自定义课程与其他专题将在后续模块验收后开放。</p><div className="mobile-logout"><LogoutMobile /></div></AppShell>;
}

import { Logout as LogoutMobile } from '@/features/auth/Logout';
