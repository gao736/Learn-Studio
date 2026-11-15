import {buildSchedule} from '../course/domain.ts';
import type {Goal,DaySlot} from '../course/domain.ts';
export type StudyUnit={key:string;title:string;href:string;skillId?:string};
export type StudyTask={id:string;kind:'learn'|'practice'|'review'|'weekly'|'remedial';unitKey?:string;title:string;minutes:number;state:'pending'|'started'};
export type StudyDay=DaySlot&{tasks:StudyTask[]};
export type StudyPlan={startDate:string;units:StudyUnit[];days:StudyDay[]};
export function buildStudyPlan(goal:Goal,slots:DaySlot[],units:StudyUnit[],startDate:string,occupied=new Map<string,number>()):StudyPlan{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(Date.parse(startDate))||new Date(startDate).toISOString().slice(0,10)!==startDate)throw new Error('学习计划日期无效。');
 if(!units.length||new Set(units.map(u=>u.key)).size!==units.length)throw new Error('学习路线无效。');
 const unitDay=(i:number)=>Math.floor(i*Math.min(goal.days,units.length)/units.length);
 const days=buildSchedule({...goal,startDate}).map((day,index)=>{
  const ceiling=slots[index]?slots[index].learn+slots[index].practice+slots[index].review:goal.dailyMinutes;
  const available=Math.min(ceiling,goal.dailyMinutes-(occupied.get(day.date)||0));
  if(available<5)throw new Error('学习计划与其他主题的时间冲突，请选择其他开始日期。');
  const learn=Math.floor(available*.5),practice=Math.floor(available*.3),review=available-learn-practice;
  const assigned=units.filter((_,i)=>unitDay(i)===index);
  if(assigned.length>learn)throw new Error('学习时间不足以安排全部课程，请增加天数或每日时间。');
  const tasks:StudyTask[]=assigned.map((unit,i)=>({id:`day-${index+1}-learn-${i}`,kind:'learn',unitKey:unit.key,title:unit.title,minutes:Math.floor(learn/assigned.length)+(i<learn%assigned.length?1:0),state:'pending'}));
  if(!assigned.length)tasks.push({id:`day-${index+1}-consolidate`,kind:'review',title:'回顾已学知识',minutes:learn,state:'pending'});
  const last=units.filter((_,i)=>unitDay(i)<=index).at(-1)!;
  if(practice)tasks.push({id:`day-${index+1}-practice`,kind:'practice',unitKey:last.key,title:'自主练习与独立考核',minutes:practice,state:'pending'});
  if(review)tasks.push({id:`day-${index+1}-review`,kind:'review',title:'到期复习',minutes:review,state:'pending'});
  return {...day,focus:slots[index]?.focus||day.focus,learn,practice,review,tasks};
 });
 return {startDate,units:structuredClone(units),days};
}
export function startTask(plan:StudyPlan,id:string,allowed:string[]):StudyPlan{
 const task=plan.days.flatMap(d=>d.tasks).find(t=>t.id===id);
 if(!task)throw new Error('学习任务不存在。');
 if(task.unitKey&&!allowed.includes(task.unitKey))throw new Error('学习前置证据尚未通过。');
 return {...plan,days:plan.days.map(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,state:'started' as const}:t)}))};
}
