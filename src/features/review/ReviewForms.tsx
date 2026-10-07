'use client';
import {SmallForm} from '../assessment/AssessmentForms';
import {startAction,submitAction,syncAction} from './actions';
export function SyncForm(){return <SmallForm action={syncAction} hidden={{}}><button className="button secondary">同步既有学习记录</button></SmallForm>;}
export function StartForm({cardId}:{cardId:string}){return <SmallForm action={startAction} hidden={{card_id:cardId}}><button className="button">开始回忆</button></SmallForm>;}
export function ReviewForm({id,question}:{id:string;question:{prompt:string;options:string[]}}){
  return <SmallForm action={submitAction} hidden={{attempt_id:id}}>
    <fieldset className="question"><legend>{question.prompt}</legend>{question.options.map((option,index)=><label className="option" key={index}><input type="radio" name="answer" value={index} required/><span>{option}</span></label>)}</fieldset>
    <label htmlFor="review-difficulty">这次回忆的难度</label><select id="review-difficulty" name="difficulty" defaultValue="good"><option value="hard">费力：想了很久</option><option value="good">一般：能回忆起来</option><option value="easy">轻松：很快想起来</option></select>
    <p className="note">先回忆，再选择。服务端按答案判定对错；答错会自动安排重学。</p><button className="button">保存回忆与下次时间</button>
  </SmallForm>;
}
