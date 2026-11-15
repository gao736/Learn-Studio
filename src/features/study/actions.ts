'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUser} from '../../server/session.ts';
import {createStudyPlan,startStudyTask} from './repository.ts';
import {startWeekly,submitWeekly,confirmAdjustment,resumeStudy} from './weekly-repository.ts';
export type StudyState={error:string};
function message(error:unknown){return error instanceof Error&&/^(学习|后续|找不到|课程|时间|周测)/.test(error.message)?error.message:'学习计划暂时无法保存，请稍后重试；已有记录保留。';}
export async function createStudyAction(_state:StudyState,data:FormData){
 const user=await requireUser();let id:string;
 try{id=(await createStudyPlan(user.id,String(data.get('course_key')),String(data.get('start_date')))).id;}
 catch(error){return {error:message(error)};}
 revalidatePath('/study');revalidatePath('/today');redirect(`/study/${id}`);
}
export async function startStudyAction(_state:StudyState,data:FormData){
 const user=await requireUser();let href:string;
 try{href=(await startStudyTask(user.id,String(data.get('plan_id')),String(data.get('task_id')),Number(data.get('revision')))).href;}
 catch(error){return {error:message(error)};}
 revalidatePath(`/study/${data.get('plan_id')}`);revalidatePath('/today');redirect(href);
}

export async function startWeeklyAction(_state:StudyState,data:FormData){
 const user=await requireUser();let id:string;try{id=await startWeekly(user.id,String(data.get('plan_id')));}catch(error){return {error:message(error)};}revalidatePath('/weekly');redirect('/weekly/session/'+id);
}
export async function submitWeeklyAction(_state:StudyState,data:FormData){
 const user=await requireUser(),id=String(data.get('session_id'));try{await submitWeekly(user.id,id,Object.fromEntries(data));}catch(error){return {error:message(error)};}revalidatePath('/weekly');redirect('/weekly/session/'+id);
}
export async function confirmWeeklyAction(_state:StudyState,data:FormData){
 const user=await requireUser(),id=String(data.get('session_id')),plan=String(data.get('plan_id'));
 try{await confirmAdjustment(user.id,plan,id,Number(data.get('revision')));}catch(error){return {error:message(error)};}revalidatePath('/study/'+plan);revalidatePath('/today');redirect('/weekly/session/'+id);
}
export async function resumeStudyAction(_state:{error:string;saved?:boolean},data:FormData){
 const user=await requireUser(),id=String(data.get('plan_id'));try{await resumeStudy(user.id,id,String(data.get('start_date')),Number(data.get('revision')));}catch(error){return {error:message(error)};}
 revalidatePath('/study/'+id);revalidatePath('/today');return {error:'',saved:true};
}
