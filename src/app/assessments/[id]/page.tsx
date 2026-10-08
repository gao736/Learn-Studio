import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getPack,getProgress,assessmentHistory} from '@/features/assessment/repository';
import {StartForm,AICheckForm} from '@/features/assessment/AssessmentForms';
import {aiCheckStatus} from '@/features/assessment/ai';
export default async function Path({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(),{id}=await params;const pack=await getPack(user.id,id);if(!pack)notFound();
  const [progress,history]=await Promise.all([getProgress(user.id,id),assessmentHistory(user.id,id)]);
  const check=await aiCheckStatus(user.id,id);
  const checking=check&&['queued','running'].includes(check.status)&&Date.now()-new Date(check.updated_at).getTime()<180000;
  return <AppShell user={user} active="/assessments"><Link className="text-link" href="/assessments">← 能力诊断</Link><header className="page-heading"><h1>{pack.spec.title}</h1><p>题库版本 {pack.spec.version} · {pack.provenance==='curated'?'有来源预置示例':pack.approval_mode==='ai'?'AI 评估，待验证':pack.status==='approved'?'真实课程的人工核对题库':'真实课程，题库等待核对'}</p></header>
    {pack.approval_mode==='ai'&&<p className="hint-box">AI 评估，待验证。题库已对照来源自动核对，仅用于学习进度解锁；尚未人工审核，不是完整掌握或能力认证。</p>}
    {pack.status!=='approved'?<section className="card"><h2>题库等待核对</h2><p>AI 将检查来源、评分依据、题族和前置关系。核对通过后开放诊断与补习；不确定时保持未开放。原课练习不能直接刷出通过。</p>{check&&<p role="status">{checking?(check.status==='queued'?'任务已排队':'正在对照来源核对，最多约两分钟'):check.error||'任务中断或过期，可点击重新核对；历史记录保留。'}</p>}{!checking?<AICheckForm packId={id}/>:<p className="note">任务已保存；中断后返回此页继续查看，过期时可再次点击恢复。</p>}<Link className="text-link" href={`/assessments/${id}`}>刷新核对进度</Link></section>:<div className="assessment-skills">{pack.spec.skills.map((skill,index)=>{
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
