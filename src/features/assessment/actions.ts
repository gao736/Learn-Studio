'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUser} from '../../server/session.ts';
import {startAssessment,submitAssessment,requestHelp,requestReview,resolveReview,createCandidate,publishPack} from './repository.ts';
import {requestAICheck} from './ai.ts';
export type FormState={error:string;success?:string};
function failure(error:unknown){return error instanceof Error&&/^(考核|复核|找不到|硅基流动|模型预算)/.test(error.message)?error.message:'暂时无法保存，请稍后重试。当前输入保留。';}
function refresh(){revalidatePath('/assessments','layout');revalidatePath('/today');}
export async function startAction(_state:FormState,data:FormData){
  const user=await requireUser();let id:string;
  try{id=(await startAssessment(user.id,String(data.get('pack_id')),String(data.get('skill_id')),String(data.get('mode')))).id;}
  catch(e){return {error:failure(e)};}refresh();redirect(`/assessments/session/${id}`);
}
export async function submitAction(_state:FormState,data:FormData){
  const user=await requireUser(),id=String(data.get('session_id'));
  try{await submitAssessment(user.id,id,Object.fromEntries(data));}catch(e){return {error:failure(e)};}
  refresh();redirect(`/assessments/session/${id}`);
}
export async function helpAction(id:string,qid:string,kind:string){
  const user=await requireUser();
  try{return {error:'',text:await requestHelp(user.id,id,qid,kind)};}catch(e){return {error:failure(e),text:''};}
}
export async function reviewAction(_state:FormState,data:FormData){
  const user=await requireUser();
  try{await requestReview(user.id,String(data.get('session_id')),String(data.get('question_id')),String(data.get('reason')));}catch(e){return {error:failure(e)};}
  refresh();return {error:'',success:'复核请求已保存，处理前暂停通过判定。'};
}
export async function resolveAction(_state:FormState,data:FormData){
  const user=await requireUser(),choice=data.get('correct');
  if(choice!=='true'&&choice!=='false')return {error:'复核请选择明确结论。'};
  try{await resolveReview(user.id,String(data.get('review_id')),choice==='true',String(data.get('rationale')));}catch(e){return {error:failure(e)};}
  refresh();return {error:'',success:'复核决定与依据已保存。'};
}
export async function candidateAction(_state:FormState,data:FormData){
  const user=await requireUser();let id:string;
  try{id=await createCandidate(user.id,String(data.get('course_id')));}catch(e){return {error:failure(e)};}
  refresh();redirect(`/assessments/${id}`);
}
export async function publishAction(_state:FormState,data:FormData){
  const user=await requireUser();
  try{const text=String(data.get('spec'));if(text.length>200000)throw new Error('考核题库超过编辑大小限制。');await publishPack(user.id,String(data.get('pack_id')),JSON.parse(text),String(data.get('rationale')));}
  catch(e){return {error:e instanceof SyntaxError?'考核题库不是有效JSON。':failure(e)};}
  refresh();return {error:'',success:'题库版本与审核依据已保存。'};
}
export async function aiCheckAction(_state:FormState,data:FormData){
  const user=await requireUser();
  try{await requestAICheck(user.id,String(data.get('pack_id')));}catch(e){return {error:failure(e)};}
  refresh();return {error:'',success:'AI核对任务已保存，可离开后回来查看。请刷新查看进度。'};
}
