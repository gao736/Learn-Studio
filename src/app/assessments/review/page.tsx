import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {isReviewer,reviewWork} from '@/features/assessment/repository';
import {ResolveForm,PublishForm} from '@/features/assessment/AssessmentForms';
export default async function Reviews(){
  const user=await requireUser();if(!await isReviewer(user.id))return <AppShell user={user} active="/assessments"><h1>没有复核权限</h1><p>此入口只供显式授权的复核人员使用。</p><Link className="text-link" href="/assessments">返回能力诊断</Link></AppShell>;
  const {reviews,packs}=await reviewWork(user.id);
  return <AppShell user={user} active="/assessments"><Link className="text-link" href="/assessments">← 能力诊断</Link><header className="page-heading"><h1>授权复核工作台</h1><p>不能复核自己的作答或批准自己的题库；原始评分保留。</p></header>
    {!reviews.length&&!packs.length&&<p className="hint-box">目前没有待处理的复核或题库。</p>}
    {reviews.map(r=>{const q=r.questions.find((q:any)=>q.id===r.question_id);return <section className="card review-card" key={r.id}><h2>{q.prompt}</h2><p>提交答案：{q.type==='choice'?q.options[Number(r.answers[q.id])]:r.answers[q.id]}</p><p>申请原因：{r.reason}</p><p className="hint-box">评分依据：{q.explanation}</p><p className="note">题族：{q.family}；请核对来源与题意，不能只依据模型建议。</p>{r.sources.filter((s:any)=>q.sourceIds.includes(s.id)).map((s:any)=><a className="text-link" key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>)}<ResolveForm reviewId={r.id}/></section>;})}
    {packs.map(p=><section className="card review-card" key={p.id}><h2>{p.spec.title} · 题库审核</h2><p>需补充新题与补测变式，区分题族、核对前置和来源。原课练习禁止作为独立考核题；实操技能必须标注requiresPractice。</p>{p.spec.sources.map((s:any)=><p key={s.id}><a className="text-link" href={s.url} target="_blank" rel="noopener noreferrer">{s.title||s.id}</a></p>)}<PublishForm packId={p.id} spec={JSON.stringify(p.spec,null,2)}/></section>)}
  </AppShell>;
}
