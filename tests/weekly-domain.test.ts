import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStudyPlan} from '../src/features/study/domain.ts';
import {buildSchedule} from '../src/features/course/domain.ts';
import {astronomyPack} from '../src/features/assessment/catalog.ts';
import {questionKey} from '../src/features/assessment/domain.ts';
import {pickWeeklyQuestions,adjustStudyPlan,resumeStudyPlan,studyWeek} from '../src/features/study/weekly-domain.ts';
const goal={topic:'天文',goal:'基础',days:30,dailyMinutes:30,startDate:'2026-11-01',sourceUrls:[]};
const units=[{key:'first:',title:'入门',href:'/lesson/astronomy'},{key:'skill:light',title:'光',href:'/assessments/astronomy/light'},{key:'skill:life',title:'恒星',href:'/assessments/astronomy/life'}];
test('weekly selection uses five unseen approved choice families from passed skills only',()=>{
 const used=astronomyPack.questions.filter(q=>q.skill==='light'&&q.id.endsWith('-1')).map(questionKey);
 const questions=pickWeeklyQuestions(astronomyPack,['light'],used);
 assert.equal(questions.length,5);assert.equal(new Set(questions.map(q=>q.family)).size,5);
 assert.ok(questions.every(q=>q.skill==='light'&&q.type==='choice'&&!used.includes(questionKey(q))));
 assert.throws(()=>pickWeeklyQuestions(astronomyPack,['light'],astronomyPack.questions.map(questionKey)),/新题/);
 assert.throws(()=>studyWeek('2026-11-01','2026-11-06'),/第七天/);assert.equal(studyWeek('2026-11-01','2026-11-07'),1);assert.equal(studyWeek('2026-11-01','2026-11-14'),2);
});
test('weekly suggestions preserve past, started and completed learning tasks and every daily total',()=>{
 const plan=buildStudyPlan(goal,buildSchedule(goal),units,goal.startDate);
 plan.days[8].tasks[0].state='started';const original=structuredClone(plan);
 const result=adjustStudyPlan(plan,['skill:light'],'2026-11-07',['first:','skill:light']);
 assert.ok(result.changes.length>0);assert.deepEqual(plan,original);
 assert.deepEqual(result.plan.days.slice(0,6),plan.days.slice(0,6));
 assert.equal(result.plan.days[8].tasks[0].state,'started');assert.deepEqual(result.plan.days[8].tasks[0],plan.days[8].tasks[0]);
 for(const [i,day] of result.plan.days.entries())assert.equal(day.tasks.reduce((n,t)=>n+t.minutes,0),plan.days[i].tasks.reduce((n,t)=>n+t.minutes,0));
 assert.deepEqual(result.plan.units,plan.units);assert.equal(adjustStudyPlan(plan,[],'2026-11-07',[]).changes.length,0);
});
test('resuming moves only unstarted groups, keeps IDs and evidence, and refuses shared-budget conflicts',()=>{
 const plan=buildStudyPlan(goal,buildSchedule(goal),units,goal.startDate);plan.days[0].tasks[0].state='started';const original=structuredClone(plan);
 const resumed=resumeStudyPlan(plan,'2026-12-01',[],new Map(),30);
 const before=plan.days.flatMap(d=>d.tasks),after=resumed.days.flatMap(d=>d.tasks);assert.deepEqual(after.map(t=>t.id).sort(),before.map(t=>t.id).sort());
 assert.equal(resumed.days.find(d=>d.tasks.some(t=>t.id===before[0].id))?.date,'2026-11-01');
 assert.ok(resumed.days.filter(d=>d.tasks.some(t=>t.state==='pending')).every(d=>d.date>='2026-12-01'));
 assert.deepEqual(plan,original);assert.throws(()=>resumeStudyPlan(plan,'2026-12-01',[],new Map([['2026-12-01',30]]),30),/时间/);
});
