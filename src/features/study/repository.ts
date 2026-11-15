import {randomUUID} from 'node:crypto';
import {withUserDatabase} from '../../server/db.ts';
import {getCourse,occupiedMinutes} from '../course/repository.ts';
import {buildSchedule,courseVersion,todayInShanghai,validId} from '../course/domain.ts';
import {getProgress} from '../assessment/repository.ts';
import {astronomyPack} from '../assessment/catalog.ts';
import {buildStudyPlan,startTask} from './domain.ts';
import type {StudyPlan,StudyUnit} from './domain.ts';
import type {Pack} from '../assessment/domain.ts';
export type StudyRow={id:string;owner_id:string;course_key:string;pack_id:string;pack_version:number;source_version:string;revision:number;payload:StudyPlan};
export async function getStudySource(user:string,key:string){
 let pack:Pack,packId:string,version:string,goal,slots,title;
 if(key==='astronomy'){
  pack=astronomyPack;packId='astronomy';version='curated:astronomy-v1';title='天文学基础与恒星演化';
  goal={topic:'天文学',goal:'建立基础理解并通过独立考核',days:30,dailyMinutes:30,startDate:todayInShanghai(),sourceUrls:pack.sources.map(s=>s.url)};slots=buildSchedule(goal);
 }else{
  const course=await getCourse(user,key);
  if(!course?.material||course.status!=='ready')throw new Error('找不到可学习的课程。');
  const record=await withUserDatabase(user,async c=>(await c.query('SELECT id,spec FROM assessment_packs WHERE owner_id=$1 AND course_id=$2 AND status=\'approved\'',[user,key])).rows[0]);
  if(!record)throw new Error('后续课程题库尚未核对，请先完成题库核对；第一课仍可学习。');
  pack=record.spec as Pack;packId=record.id;version=courseVersion(course);goal=course.goal;slots=course.schedule;title=course.material.title;
 }
 const progress=await getProgress(user,packId);
 const firstHref=key==='astronomy'?'/lesson/astronomy':`/courses/${key}/lesson`;
 const units:StudyUnit[]=[{key:'first:',title:key==='astronomy'?'恒星、行星与卫星':'入门课：'+title,href:firstHref},...pack.skills.map(s=>({key:`skill:${s.id}`,skillId:s.id,title:s.title,href:`/assessments/${packId}/${s.id}`}))];
 const firstDone=await withUserDatabase(user,async c=>(await c.query('SELECT id FROM lesson_attempts WHERE owner_id=$1 AND lesson_id=$2 LIMIT 1',[user,key==='astronomy'?'astronomy':`course:${key}`])).rowCount!>0);
 const doneKeys=[...(firstDone?['first:']:[]),...pack.skills.filter(s=>progress[s.id]?.passed).map(s=>`skill:${s.id}`)];
 const openKeys=['first:',...pack.skills.filter(s=>s.prerequisites.every(id=>progress[id]?.passed)).map(s=>`skill:${s.id}`)];
 return {key,title,goal,slots,units,packId,packVersion:pack.version,version,doneKeys,openKeys};
}
export async function getStudyPlan(user:string,id:string):Promise<StudyRow|null>{
 if(!validId(id))return null;
 return withUserDatabase(user,async c=>(await c.query<StudyRow>('SELECT * FROM study_plans WHERE id=$1 AND owner_id=$2',[id,user])).rows[0]??null);
}
export async function listStudyPlans(user:string){return withUserDatabase(user,async c=>(await c.query<StudyRow>('SELECT * FROM study_plans WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 50',[user])).rows);}
export async function studyPlanForCourse(user:string,key:string){return withUserDatabase(user,async c=>(await c.query<StudyRow>('SELECT * FROM study_plans WHERE owner_id=$1 AND course_key=$2',[user,key])).rows[0]??null);}
export async function createStudyPlan(user:string,key:string,startDate:string):Promise<StudyRow>{
 const source=await getStudySource(user,key);
 return withUserDatabase(user,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))',[user]);
  const existing=(await c.query<StudyRow>('SELECT * FROM study_plans WHERE owner_id=$1 AND course_key=$2',[user,key])).rows[0];if(existing)return existing;
  if(startDate<todayInShanghai())throw new Error('学习计划开始日期不能早于今天，请选择恢复学习日期。');
  const payload=buildStudyPlan(source.goal,source.slots,source.units,startDate,await occupiedMinutes(c,user,key));
  const row=(await c.query<StudyRow>('INSERT INTO study_plans(id,owner_id,course_key,pack_id,pack_version,source_version,payload) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),user,key,source.packId,source.packVersion,source.version,JSON.stringify(payload)])).rows[0];
  await c.query('INSERT INTO study_plan_versions(plan_id,owner_id,revision,payload,reason) VALUES($1,$2,0,$3,\'建立连续学习计划\')',[row.id,user,JSON.stringify(payload)]);return row;
 });
}
export async function startStudyTask(user:string,id:string,taskId:string,expected:number){
 if(!validId(id)||!Number.isInteger(expected)||expected<0||typeof taskId!=='string'||taskId.length>120)throw new Error('学习任务凭证无效。');
 const initial=await getStudyPlan(user,id);if(!initial)throw new Error('找不到这个学习计划。');
 const source=await getStudySource(user,initial.course_key);
 return withUserDatabase(user,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))',[user]);
  const row=(await c.query<StudyRow>('SELECT * FROM study_plans WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,user])).rows[0];if(!row)throw new Error('找不到这个学习计划。');
  if(row.revision!==expected)throw new Error('学习计划版本已变化，请刷新后继续。');
  if(row.source_version!==source.version||row.pack_version!==source.packVersion)throw new Error('课程或题库版本已变化，原计划保留，请先核对课程。');
  const task=row.payload.days.flatMap(d=>d.tasks).find(t=>t.id===taskId);
  const unit=source.units.find(u=>u.key===task?.unitKey);if(!unit)throw new Error('学习任务不存在或请从复习入口继续。');
  const payload=startTask(row.payload,taskId,source.openKeys);
  if(task!.state==='started')return {href:unit.href,revision:row.revision};
  const revision=row.revision+1;
  await c.query('UPDATE study_plans SET revision=$2,payload=$3,updated_at=now() WHERE id=$1',[id,revision,JSON.stringify(payload)]);
  await c.query('INSERT INTO study_plan_versions(plan_id,owner_id,revision,payload,reason) VALUES($1,$2,$3,$4,\'开始学习任务\')',[id,user,revision,JSON.stringify(payload)]);
  return {href:unit.href,revision};
 });
}

export async function studyPlanHistory(user:string,id:string){
 if(!validId(id))return [];
 return withUserDatabase(user,async c=>(await c.query<{revision:number;reason:string;start_date:string;day_count:number}>("SELECT revision,reason,payload->>'startDate' AS start_date,jsonb_array_length(payload->'days') AS day_count FROM study_plan_versions WHERE owner_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 50",[user,id])).rows);
}
