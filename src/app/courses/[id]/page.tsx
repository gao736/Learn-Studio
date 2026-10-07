import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/session';
import { AppShell } from '@/components/AppShell';
import { getCourse } from '@/features/course/repository';
import { GenerateControl,SourceForm } from '@/features/course/CourseForms';
import { CandidateForm } from '@/features/assessment/AssessmentForms';
export default async function CoursePage({params}:{params:Promise<{id:string}>}) {
  const user = await requireUser(), {id} = await params;
  const course = await getCourse(user.id,id); if (!course) notFound();
  const stale = !!course.generation_updated_at && Date.now()-new Date(course.generation_updated_at).getTime() >= 180000;
  const months = [...new Set(course.schedule.map(day=>day.month))];
  return <AppShell user={user} active="/courses"><div className="topline"><Link className="text-link" href="/courses">← 我的课程</Link><span className="status-badge">{course.status === 'ready' ? '第一课已保存' : '课程草案已保存'}</span></div>
    <header className="page-heading"><p className="eyebrow">YOUR LEARNING PLAN</p><h1>{course.goal.topic}</h1><p>{course.goal.goal}</p><div className="meta-row"><span>{course.goal.days}天</span><span>每日总时间预算 {course.goal.dailyMinutes}分钟</span><span>{course.goal.startDate}开始</span></div></header>
    {course.provenance === 'simulation' && <div className="alert">模拟测试课程<p className="note">由验收夹具提供，没有真实模型调用；不作为真实教学效果证据。</p></div>}
    <div className="two-col"><section className="card"><span className="card-label">当前可学习内容</span><h2>{course.material?.lesson.title || '先生成你的第一课'}</h2><p className="muted">{course.material?.scope || '以入门基础为起点。只保存课程骨架，尚未生成教学正文。'}</p>
      {course.error && <div className="alert course-error" role="alert">{course.error}</div>}
      {course.status === 'ready' ? <Link className="button" href={`/courses/${id}/lesson`}>学习第一课</Link> : <GenerateControl courseId={id} status={course.status} serverError={course.error} recoverable={stale}/>}
      {['draft','failed'].includes(course.status) && <SourceForm courseId={id} sourceUrls={course.goal.sourceUrls}/>}<p className="note">新生成仅使用硅基流动免费文本模型，调用前核对价格；核价失败会停止。只有保存完成的内容才显示可学习。</p>
      {course.model_name&&<p className="note">本次任务：{course.model_provider==='siliconflow'?'硅基流动':'百炼历史任务'} · {course.model_name}</p>}
      {course.accounted_fen != null && <p className="note">最近一次调用：{course.billing_status === 'unknown' ? '费用待核对，安全预占计入内部预算，并非已确认账单' : course.billing_status === 'simulation' ? '模拟，未调用模型' : course.billing_status==='free'?'按免费价格估算，实际账单仍待核对':'本地保守估算'} · ¥{(course.accounted_fen/100).toFixed(2)}</p>}
    </section><section className="card"><span className="card-label">时间如何安排</span><h2>新内容、实践、复习</h2><p className="muted">初始约50% / 30% / 20%。同一天已有主题占用的分钟先扣除；每个日期都有明确上限。</p><p className="note">已完成的客观练习可进入间隔复习；跨周时间重排尚未开放。首课答题记录不代表完整掌握；独立考核需审核题库。</p>{course.sources.map(source=><p key={source.id}><a className="text-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}</section></div>
    {course.status==='ready'&&course.provenance==='real'&&<section className="card assessment-history"><h2>建立独立诊断与考核</h2><p>原课练习不作为解锁证据。新题的题族、前置关系、评分依据与补测内容经人工核对后，才能开放诊断和解锁。</p><CandidateForm courseId={id}/></section>}
    <section className="plan-section"><p className="eyebrow">MONTH / WEEK / DAY</p><h2>月、周、日计划</h2><p className="muted">未来日期为课程骨架，尚未生成正文。只有第一课开放学习。</p>
    {months.map(month=><details className="month-plan card" key={month} open><summary>{month}</summary>{[...new Set(course.schedule.filter(d=>d.month===month).map(d=>d.week))].map(week=><section key={week} className="week-plan"><h3>第 {week} 周 · {course.schedule.find(d=>d.week===week)!.focus}</h3><div className="day-list">{course.schedule.filter(d=>d.month===month&&d.week===week).map(day=><div key={day.date} className="day-row"><div><strong>{day.date}</strong><p className="note">第{day.day}天 · {day.day===1&&course.status==='ready' ? '第一课可学习' : '计划骨架'}</p></div><p>新内容 {day.learn}分钟 · 实践 {day.practice}分钟 · 复习预留 {day.review}分钟</p><span className="pill">合计 {day.learn+day.practice+day.review}分钟</span></div>)}</div></section>)}</details>)}
    </section>
  </AppShell>;
}
