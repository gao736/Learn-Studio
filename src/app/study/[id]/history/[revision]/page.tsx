import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {studyPlanVersion} from '@/features/study/repository';
export default async function History({params}:{params:Promise<{id:string;revision:string}>}){
 const user=await requireUser(),{id,revision}=await params,snapshot=await studyPlanVersion(user.id,id,Number(revision));if(!snapshot)notFound();return <AppShell user={user} active="/courses"><Link className="text-link" href={'/study/'+id}>← 返回当前计划</Link><header className="page-heading"><h1>学习计划历史版本{snapshot.revision}</h1><p>{snapshot.reason}</p></header><p className="hint-box">这是保存时的安排，只读展示；当前成绩与掌握证据独立保留。</p>{snapshot.payload.days.map(d=><section className="card study-day" key={d.date}><h2>{d.date} · 第{d.week}周</h2><ul>{d.tasks.map(t=><li key={t.id}>{t.title} · {t.minutes}分钟 · {t.state==='started'?'已开始':'待安排'}</li>)}</ul></section>)}</AppShell>;
}
