import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {listStudyPlans} from '@/features/study/repository';
export default async function Studies(){
 const user=await requireUser(),plans=await listStudyPlans(user.id);
 return <AppShell user={user} active="/courses"><header className="page-heading"><h1>连续学习计划</h1><p>课程、独立考核与复习，按你的时间继续。</p><Link className="button" href="/study/new/astronomy">开始天文学连续学习</Link></header>{plans.length?<div className="course-list">{plans.map(p=><section className="card" key={p.id}><h2>{p.payload.units[0]?.title||'已保存的学习计划'}</h2><p>{p.payload.units.length}个学习环节 · {p.payload.days.length}天 · {p.payload.startDate}开始</p><Link className="text-link" href={`/study/${p.id}`}>继续此计划</Link></section>)}</div>:<section className="card"><h2>先安排一条学习路线</h2><p>可从有来源的天文学示例开始，也可在自己的真实课程题库核对后接入后续技能课。</p></section>}<Link className="text-link" href="/courses">查看自定义课程</Link></AppShell>;
}
