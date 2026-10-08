import { PgBoss } from 'pg-boss';
export const courseQueue = process.env.COURSE_QUEUE || 'course-generate';
export const assessmentQueue = process.env.ASSESSMENT_QUEUE || 'assessment-ai-check';
const globalQueue = globalThis as typeof globalThis & { courseBoss?:Promise<PgBoss> };
export async function getBoss() {
  if (!globalQueue.courseBoss) globalQueue.courseBoss = (async () => {
    const boss = new PgBoss({ connectionString:process.env.DATABASE_URL, max:2 });
    boss.on('error', () => console.error('后台任务数据库暂时不可用。'));
    await boss.start();
    await boss.createQueue(courseQueue, { retryLimit:0, expireInSeconds:120 });
    await boss.createQueue(assessmentQueue, { retryLimit:0, expireInSeconds:180 });
    return boss;
  })().catch(error => { delete globalQueue.courseBoss; throw error; });
  return globalQueue.courseBoss;
}
