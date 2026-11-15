import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {withUserDatabase} from '../../server/db.ts';
import {validId,todayInShanghai,courseVersion} from '../course/domain.ts';
import {occupiedMinutes} from '../course/repository.ts';
import {packIn,progressIn,usedQuestionKeys} from '../assessment/repository.ts';
import type {Question,Pack} from '../assessment/domain.ts';
import type {StudyRow} from './repository.ts';
import {compatibleSourceVersions} from './domain.ts';
import {studyWeek,pickWeeklyQuestions,adjustStudyPlan,resumeStudyPlan,adjustmentToken} from './weekly-domain.ts';
type Change=ReturnType<typeof adjustStudyPlan>['changes'][number];
type Feedback={id:string;skill:string;prompt:string;chosen:string;correct:boolean;correctAnswer:string;explanation:string;sourceIds:string[]};
type Weekly={id:string;owner_id:string;plan_id:string;week:number;pack_version:number;source_version:string;state:string;questions:Question[];sources:Pack['sources'];feedback:Feedback[];expires_at:Date;adjusted_at:Date|null;applied_changes:Change[]};
async function locks(c:PoolClient,user:string){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1)),pg_advisory_xact_lock(hashtextextended($1,2))',[user]);}
async function ownPlan(c:PoolClient,user:string,id:string){
 if(!validId(id))throw new Error('找不到这个学习计划。');
 const row=(await c.query<StudyRow>('SELECT * FROM study_plans WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,user])).rows[0];if(!row)throw new Error('找不到这个学习计划。');return row;
}
async function ownWeekly(c:PoolClient,user:string,id:string){
 if(!validId(id))throw new Error('找不到这个周测。');const row=(await c.query<Weekly>('SELECT * FROM weekly_sessions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,user])).rows[0];if(!row)throw new Error('找不到这个周测。');return row;
}
async function context(c:PoolClient,user:string,plan:StudyRow){
 const pack=await packIn(c,user,plan.pack_id);if(!pack||pack.status!=='approved'||pack.spec.version!==plan.pack_version)throw new Error('周测题库版本发生变化，请先核对；原记录保留。');
 let budget=30,version='curated:astronomy-v1';
 if(plan.course_key!=='astronomy'){
  const course=(await c.query('SELECT * FROM learning_courses WHERE id::text=$1 AND owner_id=$2',[plan.course_key,user])).rows[0];
  if(!course||course.status!=='ready')throw new Error('课程暂不可用，学习记录已保留。');version=courseVersion(course);budget=course.goal.dailyMinutes;
 }
 if(version!==plan.source_version)throw new Error('课程版本已变化，请先核对；原计划保留。');
 const progress=await progressIn(c,user,pack),passed=pack.spec.skills.filter(s=>progress[s.id]?.passed).map(s=>s.id);
 const first=(await c.query('SELECT id FROM lesson_attempts WHERE owner_id=$1 AND lesson_id=$2 LIMIT 1',[user,plan.course_key==='astronomy'?'astronomy':'course:'+plan.course_key])).rowCount!>0;
 return {pack,passed,budget,done:[...(first?['first:']:[]),...passed.map(id=>'skill:'+id)]};
}
async function savePlan(c:PoolClient,user:string,plan:StudyRow,payload:StudyRow['payload'],reason:string){
 const revision=plan.revision+1;await c.query('UPDATE study_plans SET revision=$2,payload=$3,updated_at=now() WHERE id=$1',[plan.id,revision,JSON.stringify(payload)]);
 await c.query('INSERT INTO study_plan_versions(plan_id,owner_id,revision,payload,reason) VALUES($1,$2,$3,$4,$5)',[plan.id,user,revision,JSON.stringify(payload),reason]);return revision;
}
export async function startWeekly(user:string,planId:string){return withUserDatabase(user,async c=>{
 await locks(c,user);const plan=await ownPlan(c,user,planId),week=studyWeek(plan.payload.startDate,todayInShanghai()),ctx=await context(c,user,plan);
 await c.query("UPDATE weekly_sessions SET state='expired' WHERE owner_id=$1 AND state='active' AND expires_at<=now()",[user]);
 const existing=(await c.query<{id:string}>("SELECT id FROM weekly_sessions WHERE owner_id=$1 AND plan_id=$2 AND week=$3 AND state<>'expired'",[user,planId,week])).rows[0];if(existing)return existing.id;
 const questions=pickWeeklyQuestions(ctx.pack.spec,ctx.passed,await usedQuestionKeys(c,user)),id=randomUUID();
 await c.query('INSERT INTO weekly_sessions(id,owner_id,plan_id,week,pack_version,source_version,questions,sources) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,user,planId,week,plan.pack_version,plan.source_version,JSON.stringify(questions),JSON.stringify(ctx.pack.spec.sources)]);return id;
});}
export async function getWeekly(user:string,id:string){
 if(!validId(id))return null;
 return withUserDatabase(user,async c=>{const s=(await c.query<Weekly>('SELECT * FROM weekly_sessions WHERE id=$1 AND owner_id=$2',[id,user])).rows[0];if(!s)return null;
 return {id:s.id,planId:s.plan_id,week:s.week,state:s.state==='active'&&new Date(s.expires_at).getTime()<=Date.now()?'expired':s.state,questions:s.questions.map(({id,prompt,options})=>({id,prompt,options:options!})),feedback:s.state==='submitted'?s.feedback:[],sources:s.sources,expiresAt:s.expires_at,adjustedAt:s.adjusted_at,appliedChanges:s.applied_changes};});
}
export async function weeklyHistory(user:string,planId:string){return withUserDatabase(user,async c=>(await c.query<{id:string;week:number;state:string;created_at:Date}>("SELECT id,week,CASE WHEN state='active' AND expires_at<=now() THEN 'expired' ELSE state END AS state,created_at FROM weekly_sessions WHERE owner_id=$1 AND plan_id=$2 ORDER BY created_at DESC LIMIT 50",[user,planId])).rows);}
export async function submitWeekly(user:string,id:string,answers:Record<string,unknown>){return withUserDatabase(user,async c=>{
 await locks(c,user);
 // Lock the plan before the weekly session on every path.
 const ref=await getRef(c,user,id),plan=await ownPlan(c,user,ref.plan_id),s=await ownWeekly(c,user,id);if(s.state==='submitted')return;
 if(s.state!=='active'||new Date(s.expires_at).getTime()<=Date.now())throw new Error('周测已过期，请返回申请新题；此前记录保留。');
 await context(c,user,plan);if(s.pack_version!==plan.pack_version||(s.source_version!==plan.source_version&&!compatibleSourceVersions(s.source_version,plan.source_version)))throw new Error('周测版本发生变化，请返回计划页。');
 const saved:Record<string,string>={},feedback:Feedback[]=s.questions.map(q=>{
  const a=answers[q.id];if(typeof a!=='string'||!/^\d+$/.test(a)||!Number.isSafeInteger(Number(a))||Number(a)>=q.options!.length)throw new Error('周测请完成全部题目并选择有效答案。');saved[q.id]=a;
  return {id:q.id,skill:q.skill,prompt:q.prompt,chosen:q.options![Number(a)],correct:Number(a)===q.correctIndex,correctAnswer:q.options![q.correctIndex!],explanation:q.explanation,sourceIds:q.sourceIds};
 });
 await c.query("UPDATE weekly_sessions SET state='submitted',answers=$2,feedback=$3,submitted_at=now() WHERE id=$1",[id,JSON.stringify(saved),JSON.stringify(feedback)]);
});}
async function getRef(c:PoolClient,user:string,id:string){if(!validId(id))throw new Error('找不到这个周测。');const s=(await c.query<{plan_id:string}>('SELECT plan_id FROM weekly_sessions WHERE id=$1 AND owner_id=$2',[id,user])).rows[0];if(!s)throw new Error('找不到这个周测。');return s;}
async function suggestion(c:PoolClient,user:string,plan:StudyRow,s:Weekly,date=todayInShanghai()){
 if(s.plan_id!==plan.id||s.state!=='submitted')throw new Error('周测尚未提交或不属于这个计划。');const ctx=await context(c,user,plan);
 if(s.pack_version!==plan.pack_version||(s.source_version!==plan.source_version&&!compatibleSourceVersions(s.source_version,plan.source_version)))throw new Error('周测版本发生变化，旧结果保留。');
 const weak=[...new Set(s.feedback.filter(q=>!q.correct).map(q=>'skill:'+q.skill))];return adjustStudyPlan(plan.payload,weak,date,ctx.done);
}
export async function previewAdjustment(user:string,planId:string,id:string){return withUserDatabase(user,async c=>{
 await locks(c,user);const plan=await ownPlan(c,user,planId),s=await ownWeekly(c,user,id),date=todayInShanghai(),result=await suggestion(c,user,plan,s,date);return {revision:plan.revision,token:adjustmentToken(plan.revision,date,result.changes),changes:s.adjusted_at?s.applied_changes:result.changes,adjusted:!!s.adjusted_at};
});}
export async function confirmAdjustment(user:string,planId:string,id:string,expected:number,token:string){return withUserDatabase(user,async c=>{
 await locks(c,user);const plan=await ownPlan(c,user,planId),s=await ownWeekly(c,user,id);
 if(s.plan_id!==plan.id||s.state!=='submitted')throw new Error('周测尚未提交或不属于这个计划。');if(s.adjusted_at)return;
 if(!Number.isInteger(expected)||expected!==plan.revision)throw new Error('学习计划版本已变化，请刷新调整建议。');
 const date=todayInShanghai(),result=await suggestion(c,user,plan,s,date);if(typeof token!=='string'||token!==adjustmentToken(plan.revision,date,result.changes))throw new Error('学习调整建议已变化，请刷新后重新确认。');if(result.changes.length)await savePlan(c,user,plan,result.plan,'第'+s.week+'周测后确认薄弱点补习');
 await c.query('UPDATE weekly_sessions SET adjusted_at=now(),applied_changes=$2 WHERE id=$1',[id,JSON.stringify(result.changes)]);
});}
export async function resumeStudy(user:string,planId:string,date:string,expected:number){return withUserDatabase(user,async c=>{
 await locks(c,user);const plan=await ownPlan(c,user,planId);if(!Number.isInteger(expected)||expected!==plan.revision)throw new Error('学习计划版本已变化，请刷新后重新确认。');if(date<todayInShanghai())throw new Error('学习恢复日期不能早于今天。');
 const ctx=await context(c,user,plan),payload=resumeStudyPlan(plan.payload,date,ctx.done,await occupiedMinutes(c,user,plan.course_key),ctx.budget);
 await savePlan(c,user,plan,payload,'确认恢复未开始的学习安排');
});}
