import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/server/session';
import { listCourses } from '@/features/course/repository';
const labels:Record<string,string> = {draft:'已保存草案',queued:'等待生成',running:'生成中',ready:'首课可学习',failed:'需要处理'};
export default async function Courses() {
  const user = await requireUser(), courses = await listCourses(user.id);
  return <AppShell user={user} active="/courses"><header className="page-heading"><p className="eyebrow">YOUR COURSES</p><h1>从你想学的主题开始。</h1><p>确认范围与时间，生成课程骨架，再完成第一课。</p><Link className="button" href="/courses/new">创建自定义课程</Link></header>
    <p className="hint-box">M02 本机功能开发版：真实百炼生成尚待验收。后续课堂正文、诊断解锁及间隔复习会在对应模块验收后开放。</p>
    {courses.length ? <div className="course-list">{courses.map(course=><article key={course.id} className="card"><span className="status-badge">{labels[course.status]}</span><h2>{course.material?.title || course.goal.topic}</h2><p className="muted">{course.goal.days}天 · 每日总预算{course.goal.dailyMinutes}分钟 · {course.goal.startDate}开始</p>{course.provenance === 'simulation' && <p className="alert">模拟测试课程</p>}<Link className="text-link" href={`/courses/${course.id}`}>查看课程与计划</Link></article>)}</div> : <section className="card"><h2>还没有自定义课程</h2><p className="muted">可以只输入主题，默认30天、每日30分钟。草案先保存，配置真实服务后可以继续生成。</p></section>}
  </AppShell>;
}
