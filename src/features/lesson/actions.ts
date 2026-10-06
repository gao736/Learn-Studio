'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '../../server/session.ts';
import { gradeAstronomyQuiz } from './quiz.ts';
import { saveAttempt } from './repository.ts';

export async function submitQuiz(_previous: { error: string }, data: FormData) {
  const user = await requireUser();
  const answers = Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'q5'].map(id => [id, data.get(id)]));
  try { gradeAstronomyQuiz(answers); }
  catch (error) { return { error: error instanceof Error ? error.message : '请检查所选答案。' }; }
  const key = data.get('submission_key');
  if (typeof key !== 'string') return { error: '提交凭证缺失，请刷新课堂后重试。' };
  let id: string;
  try { id = (await saveAttempt(user.id, key, answers)).id; }
  catch { return { error: '结果暂时无法保存，请稍后重试。你的选项仍保留在页面上。' }; }
  revalidatePath('/today');
  redirect(`/results/${id}`);
}
