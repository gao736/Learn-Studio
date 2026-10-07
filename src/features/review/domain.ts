import {fsrs,generatorParameters,Rating} from 'ts-fsrs';
import type {CardInput,Grade} from 'ts-fsrs';
export type ReviewQuestion={prompt:string;options:string[];correctIndex:number;explanation:string;sources:{title:string;url:string}[]};
export const reviewParameters=generatorParameters({request_retention:.9,enable_fuzz:false,learning_steps:['1m','10m'],relearning_steps:['10m']});
export const algorithm='ts-fsrs@5.4.2 / FSRS-6';
const scheduler=fsrs(reviewParameters);
export function scheduleReview(question:ReviewQuestion,card:CardInput,answer:unknown,difficulty:unknown,now:Date){
  if(typeof answer!=='string'||!/^\d+$/.test(answer)||!Number.isSafeInteger(Number(answer))||Number(answer)>=question.options.length)throw new Error('复习请选择有效答案。');
  if(!['hard','good','easy'].includes(String(difficulty)))throw new Error('复习请选择回忆难度。');
  const correct=Number(answer)===question.correctIndex;
  const rating:Grade=correct?({hard:Rating.Hard,good:Rating.Good,easy:Rating.Easy} as const)[difficulty as 'hard'|'good'|'easy']:Rating.Again;
  return {correct,rating,scheduled:scheduler.next(card,now,rating)};
}
