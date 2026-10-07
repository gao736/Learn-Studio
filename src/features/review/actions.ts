'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUser} from '../../server/session.ts';
import {startReview,submitReview,syncReviews} from './repository.ts';
import type {FormState} from '../assessment/actions.ts';
function failure(e:unknown){return e instanceof Error&&/^(复习|找不到)/.test(e.message)?e.message:'暂时无法保存，请稍后重试。当前输入保留。';}
function refresh(){revalidatePath('/reviews','layout');revalidatePath('/today');}
export async function syncAction(_state:FormState,_data:FormData){
  const user=await requireUser();
  try{const result=await syncReviews(user.id);refresh();return {error:'',success:`已同步，新增 ${result.added} 道复习题。未覆盖现有排期；跳过 ${result.skipped} 项模拟、简答或失效记录。`};}
  catch(e){return {error:failure(e)};}
}
export async function startAction(_state:FormState,data:FormData){
  const user=await requireUser();let id:string;
  try{id=await startReview(user.id,String(data.get('card_id')));}catch(e){return {error:failure(e)};}
  refresh();redirect(`/reviews/session/${id}`);
}
export async function submitAction(_state:FormState,data:FormData){
  const user=await requireUser(),id=String(data.get('attempt_id'));
  try{await submitReview(user.id,id,data.get('answer'),data.get('difficulty'));}catch(e){return {error:failure(e)};}
  refresh();redirect(`/reviews/session/${id}`);
}
