import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {listReviews} from '@/features/review/repository';
import {StartForm,SyncForm} from '@/features/review/ReviewForms';
const date=(value:Date|string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
export default async function Reviews(){
  const user=await requireUser(),reviews=await listReviews(user.id);
  return <AppShell user={user} active="/reviews"><header className="page-heading"><p className="eyebrow">SPACED PRACTICE</p><h1>留一点时间，把知识记牢。</h1><p>从到期的一题开始，先回忆，再核对。</p></header>
    <div className="review-summary"><section className="card"><span className="card-label">现在可复习</span><p className="metric">{reviews.due.length}{reviews.due.length===50?'+':''} 题</p><p className="note">按到期时间排列，每次显示最多50题。</p></section><section className="card"><span className="card-label">已收集的客观题</span><p className="metric">{reviews.total} 题</p><p className="note">FSRS目标保持率90%，仍需学习效果内测。</p></section></div>
    <section className="plan-section"><h2>到期任务</h2>{reviews.due.length?<div className="assessment-skills">{reviews.due.map(c=><section className="card" key={c.id}><span className="card-label">{c.label}</span><h3>{c.prompt}</h3><p className="note">{c.provenance==='curated'?'有来源的预置示例':'真实课程的客观练习'} · 到期：{date(c.due)}</p><StartForm cardId={c.id}/></section>)}</div>:<div className="card"><h3>{reviews.total?'当前没有到期任务':'先完成一次学习'}</h3><p>{reviews.next_due?`下次到期：${date(reviews.next_due)}。`:'完成客观练习后会自动加入复习。旧记录可以在下方同步。'}</p><Link className="text-link" href="/lesson/astronomy">进入天文学示例课</Link></div>}</section>
    {reviews.paused>0&&<p className="hint-box">{reviews.paused} 道题有评分争议，已暂停自动复习。需核对题库与答案键；原始记录保留。</p>}
    <details className="plan-section"><summary className="text-link">补入以前完成的练习</summary><p className="note">仅补入有答案键的客观题。同题不会重复入卡，也不会重置下次日期。模拟课程、简答题和失效记录保留原状。</p><SyncForm/></details>
    <section className="plan-section"><h2>最近的复习记录</h2>{reviews.history.length?<ul className="review-history">{reviews.history.map(a=><li key={a.id}><div><Link className="text-link" href={`/reviews/session/${a.id}`}>{a.label} · {a.feedback.correct?'回忆正确':'需要重学'}</Link><p className="note">{date(a.submitted_at)} · 下次：{date(a.feedback.due)}</p></div></li>)}</ul>:<p className="note">还没有完成的复习记录。每次反馈和下次时间都会保存。</p>}</section>
    <p className="note">复习使用已学题目，不增加独立考核证据。可在连续学习计划完成每周回顾，并确认调整未开始的安排。</p>
  </AppShell>;
}
