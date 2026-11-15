import {randomUUID} from 'node:crypto';
import {withUserDatabase} from '../../server/db.ts';
import {getCourse,occupiedMinutes} from '../course/repository.ts';
import {buildSchedule,courseVersion,todayInShanghai,validId} from '../course/domain.ts';
import {getProgress,packIn} from '../assessment/repository.ts';
import {astronomyPack} from '../assessment/catalog.ts';
import {buildStudyPlan,startTask,compatibleSourceVersions} from './domain.ts';
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

export async function studyPlanVersion(user:string,id:string,revision:number){
 if(!validId(id)||!Number.isInteger(revision)||revision<0)return null;
 return withUserDatabase(user,async c=>(await c.query<{revision:number;reason:string;payload:StudyPlan}>('SELECT revision,reason,payload FROM study_plan_versions WHERE owner_id=$1 AND plan_id=$2 AND revision=$3',[user,id,revision])).rows[0]??null);
}

export async function completeRemedialTask(user:string,id:string,taskId:string,expected:number){
 if(!validId(id)||typeof taskId!=='string'||taskId.length>120)throw new Error('学习任务凭证无效。');
 return withUserDatabase(user,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))',[user]);
  const row=(await c.query<StudyRow>('SELECT * FROM study_plans WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,user])).rows[0];if(!row)throw new Error('找不到这个学习计划。');
  const payload=structuredClone(row.payload),task=payload.days.flatMap(d=>d.tasks).find(t=>t.id===taskId);
  if(!task||task.kind!=='remedial'||task.state==='pending')throw new Error('学习补习需要先开始阅读，完成标记不增加掌握证据。');if(task.state==='completed')return;
  if(!Number.isInteger(expected)||row.revision!==expected)throw new Error('学习计划版本已变化，请刷新后继续。');task.state='completed';const revision=row.revision+1;
  await c.query('UPDATE study_plans SET revision=$2,payload=$3,updated_at=now() WHERE id=$1',[id,revision,JSON.stringify(payload)]);
  await c.query('INSERT INTO study_plan_versions(plan_id,owner_id,revision,payload,reason) VALUES($1,$2,$3,$4,$5)',[id,user,revision,JSON.stringify(payload),'本人确认补习阅读完成，不增加独立考核证据']);
 });
}
export async function adoptStudySource(user:string,id:string,expected:number,version:string){
 const initial=await getStudyPlan(user,id);if(!initial)throw new Error('找不到这个学习计划。');const source=await getStudySource(user,initial.course_key);
 return withUserDatabase(user,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))',[user]);await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,2))',[user]);
  const row=(await c.query<StudyRow>('SELECT * FROM study_plans WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,user])).rows[0];if(!row)throw new Error('找不到这个学习计划。');
  if(!Number.isInteger(expected)||row.revision!==expected||version!==source.version)throw new Error('课程或计划版本已变化，请刷新后重新核对。');if(row.source_version===version)return;
  const course=(await c.query('SELECT * FROM learning_courses WHERE id::text=$1 AND owner_id=$2',[row.course_key,user])).rows[0],pack=await packIn(c,user,row.pack_id);
  const old=(await c.query('SELECT material FROM course_material_versions WHERE course_id::text=$1 AND owner_id=$2 AND version=$3',[row.course_key,user,row.source_version])).rows[0];
  const sameUnits=JSON.stringify(row.payload.units.map(({key,href,skillId})=>({key,href,skillId})))===JSON.stringify(source.units.map(({key,href,skillId})=>({key,href,skillId})));
  const signature=(m:any)=>[m.title,m.scope,m.weeklyTopics,m.lesson.title,m.lesson.outcome,m.lesson.practice,m.lesson.questions.map(({id,options,correctIndex,sourceIds}:any)=>({id,options,correctIndex,sourceIds}))];
  if(!course||course.status!=='ready'||courseVersion(course)!==version||!compatibleSourceVersions(row.source_version,version)||!pack||pack.status!=='approved'||pack.spec.version!==row.pack_version||source.packId!==row.pack_id||source.packVersion!==row.pack_version||!sameUnits||!old?.material||JSON.stringify(signature(old.material))!==JSON.stringify(signature(course.material)))throw new Error('课程修订不兼容，请保留原计划并核对范围、题库或评分规则。');
  const revision=row.revision+1;await c.query('UPDATE study_plans SET source_version=$2,revision=$3,updated_at=now() WHERE id=$1',[id,version,revision]);
  await c.query('INSERT INTO study_plan_versions(plan_id,owner_id,revision,payload,reason) VALUES($1,$2,$3,$4,$5)',[id,user,revision,JSON.stringify(row.payload),'确认兼容正文修订：'+row.source_version+' → '+version]);
 });
}
