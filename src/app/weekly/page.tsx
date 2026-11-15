import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {listStudyPlans} from '@/features/study/repository';
export default async function Weekly(){const user=await requireUser(),plans=await listStudyPlans(user.id);return <AppShell user={user} active="/weekly"><header className="page-heading"><p className="eyebrow">WEEKLY REFLECTION</p><h1>每周回顾，调整下一步。</h1><p>用未见过的题目检查已学技能，再确认补习安排。</p></header>{plans.length?<div className="course-list">{plans.map(p=><section className="card" key={p.id}><h2>{p.payload.units[0].title}</h2><p>计划开始于 {p.payload.startDate} · 第七天起开放</p><Link className="text-link" href={'/study/'+p.id+'/weekly'}>查看周测与历史</Link></section>)}</div>:<section className="card"><h2>先建立一个学习计划</h2><p>完成基础学习后，周测会从已通过技能中选择新题。</p><Link className="button" href="/study">选择连续课程</Link></section>}</AppShell>;}
