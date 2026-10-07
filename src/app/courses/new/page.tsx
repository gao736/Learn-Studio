import { randomUUID } from 'node:crypto';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/server/session';
import { NewCourseForm } from '@/features/course/CourseForms';
import { todayInShanghai } from '@/features/course/domain';
export default async function NewCourse() {
  const user = await requireUser();
  return <AppShell user={user} active="/courses"><div className="lesson"><header className="page-heading"><p className="eyebrow">BUILD YOUR LEARNING PLAN</p><h1>这次，你想学会什么？</h1><p>先定一个可解释、可练习的目标，再安排每天的一小步。</p></header><section className="card"><NewCourseForm submissionKey={randomUUID()} startDate={todayInShanghai()}/></section></div></AppShell>;
}
