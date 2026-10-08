'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '../../server/session.ts';
import { createCourse,requestGeneration,updateSources,saveCourseAttempt,recordDraftFailure } from './repository.ts';
function message(error:unknown, fallback:string) {
  // Only expected business validation messages reach public forms, never SQL/network diagnostics.
  return error instanceof Error && /^(主题|目标|学习|每日|开始|资料|提交|日期|每天|找不到|课程|仅|硅基流动|模型|本课程)/.test(error.message) ? error.message : fallback;
}
export async function createCourseAction(_previous:{error:string}, data:FormData) {
  const user = await requireUser(); let id:string;
  try {
    const goal = {topic:data.get('topic'),goal:data.get('goal'),days:data.get('days'),dailyMinutes:data.get('dailyMinutes'),startDate:data.get('startDate'),sourceUrls:data.get('sourceUrls')};
    id = (await createCourse(user.id,String(data.get('submission_key')),goal)).id;
  } catch(error) { return {error:message(error,'课程草案暂时无法保存，请稍后重试。输入仍保留在页面上。')}; }
  revalidatePath('/courses'); redirect(`/courses/${id}`);
}
export async function generateCourseAction(_previous:{error:string}, data:FormData) {
  const user = await requireUser(), id = String(data.get('course_id'));
  try { await requestGeneration(user.id,id); }
  catch(error) {
    const failure = message(error,'生成任务暂时无法提交，草案已保留，请重试。');
    try { await recordDraftFailure(user.id,id,failure); } catch { /* Database outage: keep the form error visible. */ }
    revalidatePath(`/courses/${id}`); return {error:failure};
  }
  revalidatePath(`/courses/${id}`); return {error:''};
}
export async function updateSourcesAction(_previous:{error:string;success?:string}, data:FormData) {
  const user = await requireUser(), id=String(data.get('course_id'));
  try { await updateSources(user.id,id,String(data.get('sourceUrls') || '')); }
  catch(error) { return {error:message(error,'资料暂时无法保存，请重试。')}; }
  revalidatePath(`/courses/${id}`); return {error:'',success:'资料链接已保存，可以重新生成。'};
}
export async function submitCourseQuiz(_previous:{error:string}, data:FormData) {
  const user = await requireUser(); let id:string;
  try {
    const answers = Object.fromEntries(['q1','q2','q3','q4','q5'].map(key=>[key,data.get(key)]));
    id = (await saveCourseAttempt(user.id,String(data.get('course_id')),String(data.get('submission_key')),answers,String(data.get('lesson_version')))).id;
  } catch(error) { return {error:message(error,'结果暂时无法保存，请重试。你的选项仍保留在页面上。')}; }
  revalidatePath('/today'); redirect(`/results/${id}`);
}
