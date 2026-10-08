import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireUser } from '@/server/session';
import { AppShell } from '@/components/AppShell';
import { getCourse } from '@/features/course/repository';
import {courseVersion} from '@/features/course/domain';
import { QuizForm } from '@/features/lesson/QuizForm';
import { submitCourseQuiz } from '@/features/course/actions';
export default async function CourseLesson({params}:{params:Promise<{id:string}>}) {
  const user = await requireUser(), {id} = await params, course = await getCourse(user.id,id);
  if (!course || course.status !== 'ready' || !course.material) notFound();
  const lesson = course.material.lesson;
  return <AppShell user={user} active="/courses"><div className="lesson"><Link className="text-link" href={`/courses/${id}`}>← 返回课程计划</Link>{course.provenance === 'simulation' && <div className="alert">模拟测试课程</div>}<p className="eyebrow">YOUR FIRST LESSON</p><h1>{lesson.title}</h1><p className="lead">{lesson.outcome}</p><p className="note">{course.provenance === 'real' ? course.content_revision ? `AI生成后补充修订 · 修订${course.content_revision}；尚未经过领域专家审核` : 'AI生成；来源关联尚未经过人工核验' : '模拟验收夹具；没有真实模型输出'} · {course.material.scope}</p>
    {lesson.sections.map((section,index)=><section className="lesson-section" key={index}><h2>{section.heading}</h2><p className="lesson-body">{section.body}</p><div className="source-list">{section.sourceIds.map(sourceId=>{const source=course.sources.find(s=>s.id===sourceId)!;return <a key={sourceId} className="text-link" href={source.url} target="_blank" rel="noopener noreferrer">来源 {sourceId}</a>;})}</div></section>)}
    <section className="hint-box"><h2>试着自己解释一次</h2><p>{lesson.practice}</p></section><section className="quiz"><h2>用五道题，检查这次理解。</h2><p className="muted">请独立作答，提交后展示答案与解释。仅记录本次表现。</p><QuizForm courseId={id} lessonVersion={courseVersion(course)} quizAction={submitCourseQuiz} submissionKey={randomUUID()} questions={lesson.questions.map(({id,prompt,options})=>({id,prompt,options}))}/></section>
    </div></AppShell>;
}
