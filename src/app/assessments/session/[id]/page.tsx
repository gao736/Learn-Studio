import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getAssessment,getPack,getProgress} from '@/features/assessment/repository';
import {AssessmentForm,ReviewForm} from '@/features/assessment/AssessmentForms';
export default async function SessionPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(),{id}=await params;const session=await getAssessment(user.id,id);if(!session)notFound();
  const pack=await getPack(user.id,session.packId);if(!pack)notFound();
  const progress=await getProgress(user.id,session.packId),p=progress[session.skillId];
  return <AppShell user={user} active="/assessments"><div className="lesson"><Link className="text-link" href={`/assessments/${session.packId}`}>← 技能与证据</Link>
    <p className="eyebrow">INDEPENDENT EVIDENCE</p><h1>{pack.spec.skills.find(s=>s.id===session.skillId)?.title} · {session.mode==='diagnosis'?'基础诊断':session.mode==='skip'?'跳级测验':'独立考核'}</h1>
    {session.state==='active'?<><p className="muted">五个不同题族。查看提示或答案后，本题只作练习；新题补测仍可验证理解。</p><AssessmentForm id={id} questions={session.questions} initialHelp={session.help}/></>:session.state==='expired'?<section className="alert"><h2>会话已过期</h2><p>没有保存评分；返回技能页重新申请新题。</p></section>:<>
      <section className="card"><h2>结果已保存</h2><p className="assessment-outcome">{p.passed?'达到初始通过门槛':p.pending?'等待评分复核':p.prerequisitesMissing?'前置尚未通过':'证据尚未达标'}</p><p>当前独立证据：{p.correct}项正确 / {p.families}个题族 · 估计 {p.estimate.toFixed(2)}</p><p className="note">按整个技能最近五个不同题族计算；只保留本次分数不等于长期掌握。{p.practiceMissing?'必需实操未验证，不能通过。':''}{p.prerequisitesMissing?'本技能证据保留，前置达标后再判定通过。':''}</p><Link className="button" href={`/assessments/${session.packId}/${session.skillId}`}>返回当前技能补习</Link></section>
      {session.feedback.map(q=>{const review=session.reviews.find(r=>r.question_id===q.id),correct=review?.status==='resolved'?review.correct:q.correct;return <section className="feedback card" key={q.id}><h2>{q.prompt}</h2><p>你的回答：{q.chosen}</p><p>{review?.status==='pending'?'待人工复核':correct===null?'待人工复核':correct?'符合评分依据':'需要补习'} · {q.independent?'独立作答':'使用帮助，不计独立证据'}</p><p>{q.explanation}</p>{review?<p className="hint-box">{review.status==='pending'?'复核请求已保存；处理前暂停通过判定。':`复核结论：${review.correct?'符合':'不符合'}评分依据。${review.rationale}`}</p>:<details><summary className="text-link">这题有争议？申请评分复核</summary><ReviewForm sessionId={id} questionId={q.id}/></details>}</section>;})}
    </>}
  </div></AppShell>;
}
