import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getStudySource,studyPlanForCourse} from '@/features/study/repository';
import {todayInShanghai} from '@/features/course/domain';
import {CreateStudyForm} from '@/features/study/StudyForms';
export default async function NewStudy({params}:{params:Promise<{key:string}>}){
 const user=await requireUser(),{key}=await params,existing=await studyPlanForCourse(user.id,key);if(existing)redirect(`/study/${existing.id}`);
 let source;try{source=await getStudySource(user.id,key);}catch(error){
  if(error instanceof Error&&error.message.startsWith('找不到'))notFound();
  return <AppShell user={user} active="/courses"><h1>后续课程暂未开放</h1><section className="card"><p>后续技能正文和考核题库需要先核对。原第一课、成绩与复习记录均保留。</p>{key!=='astronomy'&&<Link className="text-link" href={`/courses/${key}`}>返回原课程处理题库</Link>}</section></AppShell>;
 }
 return <AppShell user={user} active="/courses"><Link className="text-link" href="/courses">← 我的课程</Link><header className="page-heading"><p className="eyebrow">LEARN / CHECK / REMEMBER</p><h1>建立连续学习计划</h1><p>{source.title} · {source.goal.days}天 · 每日总预算{source.goal.dailyMinutes}分钟</p></header><div className="two-col"><section className="card"><h2>{source.units.length}个学习环节</h2><ol className="goal-list">{source.units.map(u=><li key={u.key}>{u.title}</li>)}</ol><p className="note">先完成入门练习，再按前置证据推进技能课；学习安排不能代替独立考核。</p><p className="note">已有题库正文可直接学习；尚未通过的前置技能会继续锁定。教学内容与初始门槛仍待学习效果验证。</p></section><section className="card"><h2>确认时间安排</h2><CreateStudyForm courseKey={key} startDate={todayInShanghai()}/></section></div></AppShell>;
}
