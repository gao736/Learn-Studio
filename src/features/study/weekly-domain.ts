import {questionKey} from '../assessment/domain.ts';
import type {Pack,Question} from '../assessment/domain.ts';
import type {StudyPlan,StudyDay} from './domain.ts';
const dateValue=(value:string)=>{const n=Date.parse(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==value)throw new Error('学习日期无效。');return n;};
export function studyWeek(start:string,at:string){const day=Math.floor((dateValue(at)-dateValue(start))/86400000)+1;if(day<7)throw new Error('周测从学习计划第七天开放。');return Math.floor(day/7);}
export function pickWeeklyQuestions(pack:Pack,passed:string[],used:string[]):Question[]{
 const retired=new Set(used),families=new Set<string>();
 const questions=pack.questions.filter(q=>{if(q.type!=='choice'||!passed.includes(q.skill)||retired.has(questionKey(q))||families.has(q.family))return false;families.add(q.family);return true;}).slice(0,5);
 if(questions.length!==5)throw new Error('周测可用新题不足五个不同题族，请先复习或等待题库补充；旧题不会重复充当新证据。');return questions;
}
function allocate(day:StudyDay):StudyDay{
 const sum=(kinds:string[])=>day.tasks.filter(t=>kinds.includes(t.kind)).reduce((n,t)=>n+t.minutes,0);
 return {...day,learn:sum(['learn','remedial']),practice:sum(['practice','weekly']),review:sum(['review'])};
}
export function adjustStudyPlan(plan:StudyPlan,weak:string[],at:string,done:string[]){
 dateValue(at);const next=structuredClone(plan),changes:{date:string;id:string;before:string;after:string;minutes:number}[]=[];
 // One bounded remedial activity per weak skill; never replace every future lesson.
 for(const key of [...new Set(weak)]){
  const unit=plan.units.find(u=>u.key===key);if(!unit)continue;
  const candidates=next.days.filter(d=>d.date>=at).flatMap(d=>d.tasks.map(t=>({day:d,task:t}))).filter(({task:t})=>t.state==='pending'&&['learn','practice','remedial'].includes(t.kind)&&!(t.kind==='learn'&&done.includes(t.unitKey||''))&&!changes.some(c=>c.id===t.id));
  if(candidates.some(({task:t})=>t.kind==='remedial'&&t.unitKey===key))continue;
  const target=candidates.find(v=>v.task.kind==='practice')||candidates[0];if(!target)continue;
  const before=target.task.title;target.task.kind='remedial';target.task.unitKey=key;target.task.title='针对性补习：'+unit.title;
  changes.push({date:target.day.date,id:target.task.id,before,after:target.task.title,minutes:target.task.minutes});
 }
 next.days=next.days.map(d=>changes.some(c=>c.date===d.date)?allocate(d):d);return {plan:next,changes};
}
export function resumeStudyPlan(plan:StudyPlan,start:string,done:string[],occupied:Map<string,number>,budget:number):StudyPlan{
 const startValue=dateValue(start),days=new Map<string,StudyDay>();
 const ensure=(date:string,original:StudyDay)=>{if(!days.has(date)){const day=Math.floor((dateValue(date)-dateValue(plan.startDate))/86400000)+1;days.set(date,{...original,date,month:date.slice(0,7),day,week:Math.max(1,Math.ceil(day/7)),tasks:[]});}return days.get(date)!;};
 let offset=0;
 for(const day of plan.days){
  const protectedTasks=day.tasks.filter(t=>t.state==='started'||(t.kind==='learn'&&done.includes(t.unitKey||'')));
  if(protectedTasks.length)ensure(day.date,day).tasks.push(...structuredClone(protectedTasks));
  const pending=day.tasks.filter(t=>!protectedTasks.includes(t));if(!pending.length)continue;
  const date=new Date(startValue+offset++*86400000).toISOString().slice(0,10);ensure(date,day).tasks.push(...structuredClone(pending));
 }
 for(const day of days.values())if(day.tasks.reduce((n,t)=>n+t.minutes,0)+(occupied.get(day.date)||0)>budget)throw new Error('学习恢复与其他任务的时间冲突，请选择其他日期。');
 return {...plan,units:structuredClone(plan.units),days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(allocate)};
}
