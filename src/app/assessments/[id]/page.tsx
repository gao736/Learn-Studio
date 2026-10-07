import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getPack,getProgress,assessmentHistory} from '@/features/assessment/repository';
import {StartForm} from '@/features/assessment/AssessmentForms';
export default async function Path({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(),{id}=await params;const pack=await getPack(user.id,id);if(!pack)notFound();
  const [progress,history]=await Promise.all([getProgress(user.id,id),assessmentHistory(user.id,id)]);
  return <AppShell user={user} active="/assessments"><Link className="text-link" href="/assessments">← 能力诊断</Link><header className="page-heading"><h1>{pack.spec.title}</h1><p>题库版本 {pack.spec.version} · {pack.provenance==='curated'?'有来源预置示例':'真实课程的人工核对题库'}</p></header>
    {pack.status!=='approved'?<section className="card"><h2>题库尚未审核</h2><p>需要核对题族、评分依据、前置关系，并补充独立诊断与补测新题。审核前不估计掌握程度，也不开放考核解锁。</p><p className="note">原课练习和模拟成绩不能直接刷出通过。申请已保存，可离开后再回来查看。</p></section>:<div className="assessment-skills">{pack.spec.skills.map((skill,index)=>{
      const p=progress[skill.id],open=skill.prerequisites.every(s=>progress[s]?.passed);
      return <section className="card" key={skill.id}><p className="card-label">技能 {index+1}</p><h2>{skill.title}</h2><p className="status-badge" data-passed={p.passed}>{p.passed?'通过':p.pending?'等待评分复核':p.practiceMissing?'需要实操验证':open?'可学习与补习':'前置尚未通过'}</p>
        <p>独立证据：{p.correct}项正确 / {p.families}个题族 · 当前证据估计 {p.estimate.toFixed(2)}</p>
        <p className="note">前置：{skill.prerequisites.map(s=>pack.spec.skills.find(v=>v.id===s)!.title).join('、')||'无'}。要求五个不同题族，估计至少0.80；此数值不是长期掌握概率。</p>
        {open?<Link className="text-link" href={`/assessments/${id}/${skill.id}`}>学习与针对性补习</Link>:<p className="note">先完成前置技能，才能阅读本课正文。诊断或跳级结果仍须满足相同门槛。</p>}
        <StartForm pack={id} skill={skill.id} canExam={open}/>
      </section>;
    })}</div>}
    {history.length>0&&<section className="card assessment-history"><h2>保存的考核记录</h2>{history.map(s=><p key={s.id}><Link className="text-link" href={`/assessments/session/${s.id}`}>{pack.spec.skills.find(v=>v.id===s.skill_id)?.title||s.skill_id} · {s.state==='submitted'?'查看结果':s.state==='expired'?'已过期':'继续作答'}</Link></p>)}</section>}
  </AppShell>;
}
