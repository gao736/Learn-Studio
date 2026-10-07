import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {listPacks,isReviewer} from '@/features/assessment/repository';
export default async function Assessments(){
  const user=await requireUser();const [packs,reviewer]=await Promise.all([listPacks(user.id),isReviewer(user.id)]);
  return <AppShell user={user} active="/assessments"><header className="page-heading"><p className="eyebrow">LEARNING EVIDENCE</p><h1>从会做，到有依据地通过。</h1><p>诊断基础，补上薄弱点，用新问题验证理解。</p></header>
    <p className="hint-box">初始门槛：五个不同题族至少四项独立正确；前置技能与必需实操也要通过。提示、答案暴露和重复题不会增加证据。</p>
    <div className="course-list">{packs.map(p=><section className="card" key={p.id}><span className="status-badge">{p.status==='approved'?'可诊断与考核':'题库待人工审核'}</span><h2>{p.spec.title}</h2><p className="muted">{p.id==='astronomy'?'有NASA来源的预置示例；不是AI生成或专家能力认证。':'私有课程题库；原课程练习不追认成独立考核。'}</p><Link className="button" href={`/assessments/${p.id}`}>查看技能与进度</Link></section>)}</div>
    <p className="note" style={{marginTop:24}}>证据估计尚未经过学习效果内测校准，不代表长期掌握率。实操验证在对应实验开放后提供。</p>
    {reviewer&&<Link className="text-link" href="/assessments/review">进入授权复核工作台</Link>}
  </AppShell>;
}
