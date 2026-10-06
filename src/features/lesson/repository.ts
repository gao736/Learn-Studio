import { randomUUID } from 'node:crypto';
import { withUserDatabase } from '../../server/db.ts';
import { gradeAstronomyQuiz } from './quiz.ts';

export type Attempt = {
  id: string; lesson_id: string; lesson_version: string; score: number; total: number;
  created_at: Date; feedback: ReturnType<typeof gradeAstronomyQuiz>['feedback'];
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function saveAttempt(userId: string, submissionKey: string, answers: Record<string, unknown>) {
  if (!uuidPattern.test(submissionKey)) throw new Error('提交凭证无效，请刷新课堂后重试。');
  const grade = gradeAstronomyQuiz(answers);
  return withUserDatabase(userId, async client => {
    const result = await client.query<Attempt>(
      `INSERT INTO lesson_attempts(id, owner_id, lesson_id, lesson_version, submission_key, score, total, answers, feedback)
       VALUES($1,$2,'astronomy','astronomy-v1',$3,$4,$5,$6,$7)
       ON CONFLICT(owner_id, submission_key) DO UPDATE SET submission_key=lesson_attempts.submission_key
       RETURNING id, lesson_id, lesson_version, score, total, created_at, feedback`,
      [randomUUID(), userId, submissionKey, grade.score, grade.total, JSON.stringify(answers), JSON.stringify(grade.feedback)],
    );
    return result.rows[0];
  });
}
export async function getAttempt(userId: string, id: string) {
  if (!uuidPattern.test(id)) return null;
  return withUserDatabase(userId, async client => (await client.query<Attempt>(
    'SELECT id, lesson_id, lesson_version, score, total, created_at, feedback FROM lesson_attempts WHERE id=$1 AND owner_id=$2', [id, userId],
  )).rows[0] ?? null);
}
export async function latestAttempt(userId: string) {
  return withUserDatabase(userId, async client => (await client.query<Attempt>(
    'SELECT id, lesson_id, lesson_version, score, total, created_at, feedback FROM lesson_attempts WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 1', [userId],
  )).rows[0] ?? null);
}
