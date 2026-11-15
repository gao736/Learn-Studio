import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSchedule} from '../src/features/course/domain.ts';
import {buildStudyPlan,startTask} from '../src/features/study/domain.ts';
const goal={topic:'天文学',goal:'理解基础概念',days:7,dailyMinutes:30,startDate:'2026-11-28',sourceUrls:[]};
const units=[{key:'first:',title:'入门课',href:'/lesson/astronomy'},{key:'skill:light',title:'天体与光',href:'/assessments/astronomy/light'},{key:'skill:life',title:'恒星的一生',href:'/assessments/astronomy/life'}];
test('study calendar links all lessons, crosses months and respects shared daily minutes',()=>{
 const occupied=new Map([['2026-11-28',20]]);
 const plan=buildStudyPlan(goal,buildSchedule(goal),units,'2026-11-28',occupied);
 assert.equal(plan.days.length,7);assert.equal(plan.days[3].date,'2026-12-01');
 const learn=plan.days.flatMap(d=>d.tasks).filter(t=>t.kind==='learn');
 assert.deepEqual(learn.map(t=>t.unitKey),units.map(u=>u.key));
 for(const day of plan.days){const sum=day.tasks.reduce((n,t)=>n+t.minutes,0);assert.equal(sum,day.learn+day.practice+day.review);assert.ok(sum+(occupied.get(day.date)||0)<=30);}
 assert.throws(()=>buildStudyPlan(goal,buildSchedule(goal),units,'2026-11-28',new Map([['2026-11-28',29]])),/时间/);
 assert.throws(()=>buildStudyPlan(goal,buildSchedule(goal),units,'invalid'),/日期/);
});
test('study start preserves the old plan, rejects locked or unknown tasks and is idempotent',()=>{
 const plan=buildStudyPlan(goal,buildSchedule(goal),units,'2026-11-28');
 const tasks=plan.days.flatMap(d=>d.tasks),first=tasks.find(t=>t.kind==='learn'&&t.unitKey==='first:')!,locked=tasks.find(t=>t.kind==='learn'&&t.unitKey==='skill:life')!;
 assert.throws(()=>startTask(plan,locked.id,['first:','skill:light']),/前置/);
 assert.throws(()=>startTask(plan,'unknown',['first:']),/任务/);
 const next=startTask(plan,first.id,['first:']);assert.equal(first.state,'pending');
 assert.equal(next.days.flatMap(d=>d.tasks).find(t=>t.id===first.id)?.state,'started');
 assert.deepEqual(startTask(next,first.id,['first:']),next);
});
test('short study plans never silently omit later lessons',()=>{
 const short={...goal,days:1,dailyMinutes:30};
 const plan=buildStudyPlan(short,buildSchedule(short),units,short.startDate);
 assert.equal(plan.days[0].tasks.filter(t=>t.kind==='learn').length,3);
 assert.equal(plan.days[0].tasks.reduce((n,t)=>n+t.minutes,0),30);
 assert.throws(()=>buildStudyPlan({...short,dailyMinutes:5},buildSchedule({...short,dailyMinutes:5}),units,short.startDate),/时间/);
});

test('a thirty-day MVP puts its three introductory lessons before the first weekly test',()=>{
 const long={...goal,days:30};const plan=buildStudyPlan(long,buildSchedule(long),units,long.startDate);
 assert.equal(plan.days.slice(0,7).flatMap(d=>d.tasks).filter(t=>t.kind==='learn').length,3);
});
