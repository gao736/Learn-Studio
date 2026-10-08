import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getPack,getStudy} from '@/features/assessment/repository';
import {StartForm} from '@/features/assessment/AssessmentForms';
export default async function Study({params}:{params:Promise<{id:string;skill:string}>}){
  const user=await requireUser(),{id,skill}=await params;const pack=await getPack(user.id,id);if(!pack||!pack.spec.skills.some(s=>s.id===skill))notFound();
  const study=await getStudy(user.id,id,skill);
  const ai=pack.approval_mode==='ai';
  return <AppShell user={user} active="/assessments"><div className="lesson"><Link className="text-link" href={`/assessments/${id}`}>← 技能与证据</Link>{!study?<section className="card"><h1>本课尚未解锁</h1><p>题库须先审核，前置技能须达到相同考核门槛。可以返回技能页诊断基础或参加跳级测验。</p></section>:<>
    <p className="eyebrow">STUDY / REMEDIATE</p><h1>{study.skill.title}</h1>{ai&&<p className="hint-box">AI 评估，待验证。达到门槛仅解锁后续学习，不等于完整掌握。</p>}<p className="lesson-body lead">{study.skill.lesson}</p>
    <div className="source-list">{study.skill.sourceIds.map(s=>{const source=pack.spec.sources.find(v=>v.id===s)!;return <a className="text-link" key={s} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>;})}</div>
    {study.remediation.length>0&&<section className="hint-box"><h2>针对性补习</h2><p>下面对应最近仍需补充证据的题族；补测使用新问题。</p>{study.remediation.map(r=><p key={r.family}>{r.text}</p>)}</section>}
    {study.progress.pending&&<p className="alert">评分等待复核，处理前暂停通过判定。</p>}
    {study.skill.requiresPractice&&<p className="alert">必需实操尚未验证。即使概念题答对，也不能判定技能通过。</p>}
    <section className="quiz"><h2>用新问题验证理解</h2><StartForm pack={id} skill={skill}/></section>
  </>}</div></AppShell>;
}
