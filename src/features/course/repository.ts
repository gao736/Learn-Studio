import { randomUUID } from 'node:crypto';
import {addReviewCards} from '../review/repository.ts';
import type { PoolClient } from 'pg';
import { withUserDatabase } from '../../server/db.ts';
import { getBoss, courseQueue } from '../../server/queue.ts';
import {modelConfig,validFreePrice} from '../../server/model.ts';
import type {FreePrice} from '../../server/model.ts';
import { validateGoal, validId, buildSchedule, validateMaterial, validateUsage,estimateFen, gradeLesson } from './domain.ts';
import type { Goal, DaySlot, Material, Usage } from './domain.ts';
export type SourceReceipt = {id:string;url:string;title:string;fetchedAt:string;digest:string};
export type Course = {id:string;submission_key:string;goal:Goal;schedule:DaySlot[];status:string;error:string;material:Material|null;sources:SourceReceipt[];provenance:string;active_generation:string|null;generation_updated_at:Date|null;billing_status:string|null;accounted_fen:number|null;model_provider:string|null;model_name:string|null;attempts:number};
const selectCourse = `SELECT c.*,g.updated_at AS generation_updated_at,g.billing_status,g.accounted_fen,g.model_provider,g.model_name,
  (SELECT count(*)::int FROM course_generations h WHERE h.course_id=c.id) AS attempts
  FROM learning_courses c LEFT JOIN course_generations g ON g.id=c.active_generation`;
async function lockUser(client:PoolClient, userId:string) { await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))',[userId]); }
export async function listCourses(userId:string) {
  return withUserDatabase(userId,async c => (await c.query<Course>(`${selectCourse} WHERE c.owner_id=$1 ORDER BY c.created_at DESC LIMIT 100`,[userId])).rows);
}
export async function getCourse(userId:string, id:string) {
  if (!validId(id)) return null;
  return withUserDatabase(userId,async c => (await c.query<Course>(`${selectCourse} WHERE c.owner_id=$1 AND c.id=$2`,[userId,id])).rows[0] ?? null);
}
export async function createCourse(userId:string, key:string, input:Record<string,unknown>) {
  if (!validId(key)) throw new Error('提交凭证无效，请刷新后重试。');
  const goal = validateGoal(input);
  return withUserDatabase(userId,async c => {
    await lockUser(c,userId);
    const existing = await c.query<Course>('SELECT * FROM learning_courses WHERE owner_id=$1 AND submission_key=$2',[userId,key]);
    if (existing.rows[0]) return existing.rows[0];
    const count = await c.query("SELECT id FROM learning_courses WHERE owner_id=$1 AND created_day=(now() AT TIME ZONE 'Asia/Shanghai')::date",[userId]);
    if (count.rowCount) throw new Error('每天最多创建一个新课程；可继续或重试已保存的课程。');
    const occupied = await c.query<{schedule:DaySlot[]}>('SELECT schedule FROM learning_courses WHERE owner_id=$1',[userId]);
    const minutes = new Map<string,number>();
    for (const row of occupied.rows) for (const day of row.schedule) minutes.set(day.date,(minutes.get(day.date)||0)+day.learn+day.practice+day.review);
    const schedule = buildSchedule(goal).map(day => {
      const available = goal.dailyMinutes-(minutes.get(day.date)||0);
      if (available < 5) throw new Error('日期与已有主题的时间安排冲突，剩余时间不足5分钟。请选择其他日期或增加每日总时间预算。');
      const learn = Math.floor(available*.5), practice = Math.floor(available*.3);
      return {...day,learn,practice,review:available-learn-practice};
    });
    const result = await c.query<Course>('INSERT INTO learning_courses(id,owner_id,submission_key,goal,schedule) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),userId,key,JSON.stringify(goal),JSON.stringify(schedule)]);
    return result.rows[0];
  });
}
const periods = (day:string) => [`day:${day}`,`month:${day.slice(0,7)}`];
function budgetLimit(name:string, maximum:number) {
  const value = Number(process.env[name] ?? maximum);
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new Error('模型预算配置无效。');
  return value;
}
async function changeBudget(c:PoolClient, day:string, delta:number, reserve=false) {
  for (const period of periods(day)) {
    await c.query('INSERT INTO model_budgets(period,used_fen) VALUES($1,0) ON CONFLICT DO NOTHING',[period]);
    const row = await c.query('SELECT used_fen FROM model_budgets WHERE period=$1 FOR UPDATE',[period]);
    const limit = period.startsWith('day:') ? budgetLimit('MODEL_DAILY_BUDGET_FEN',1000) : budgetLimit('MODEL_MONTHLY_BUDGET_FEN',35000);
    if (reserve && row.rows[0].used_fen + delta > limit) throw new Error('模型预算不足，未发起调用；请稍后再试。');
    await c.query('UPDATE model_budgets SET used_fen=used_fen+$2 WHERE period=$1',[period,delta]);
  }
}
async function settle(c:PoolClient, generation:any, cost:number, status:string, usage?:Usage) {
  await changeBudget(c,generation.budget_day,cost-generation.accounted_fen);
  await c.query('UPDATE course_generations SET accounted_fen=$2,billing_status=$3,usage=$4 WHERE id=$1',[generation.id,cost,status,usage ? JSON.stringify(usage) : null]);
}
export async function requestGeneration(userId:string, courseId:string) {
  if (!validId(courseId)) throw new Error('找不到这个课程。');
  let configurationError='',config:ReturnType<typeof modelConfig>|undefined;try{config=modelConfig();}catch(error){configurationError=(error as Error).message;}
  // Do not start or migrate a queue when configuration is absent.
  const boss = configurationError ? null : await getBoss();
  const result = await withUserDatabase(userId,async c => {
    await lockUser(c,userId);
    const course = (await c.query<Course>('SELECT * FROM learning_courses WHERE id=$1 AND owner_id=$2 FOR UPDATE',[courseId,userId])).rows[0];
    if (!course) throw new Error('找不到这个课程。');
    if (course.status === 'ready') return {id:course.active_generation!};
    const last = course.active_generation ? (await c.query('SELECT * FROM course_generations WHERE id=$1 FOR UPDATE',[course.active_generation])).rows[0] : null;
    if (last && ['queued','running'].includes(last.status)) {
      if (Date.now()-new Date(last.updated_at).getTime() < 180000) return {id:last.id};
      await settle(c,last,last.status === 'queued' ? 0 : last.reserved_fen,last.status === 'queued' ? 'estimated' : 'unknown');
      await c.query("UPDATE course_generations SET status='failed',updated_at=now() WHERE id=$1",[last.id]);
      await c.query("UPDATE learning_courses SET status='failed',error='上次任务已过期，可重新尝试。' WHERE id=$1",[courseId]);
    }
    if (configurationError) {
      await c.query("UPDATE learning_courses SET status='failed',error=$2 WHERE id=$1",[courseId,configurationError]);
      return {error:configurationError};
    }
    if (!course.goal.sourceUrls.length) {
      const error = '资料不足：此主题尚无预置来源，请补充可信公开资料链接后重试。';
      await c.query("UPDATE learning_courses SET status='failed',error=$2 WHERE id=$1",[courseId,error]); return {error};
    }
    const count = await c.query('SELECT count(*)::int AS count FROM course_generations WHERE course_id=$1',[courseId]);
    if (count.rows[0].count >= 5) {
      const error='本课程已达到五次生成尝试上限。';
      await c.query("UPDATE learning_courses SET status='failed',error=$2 WHERE id=$1",[courseId,error]);
      return {error};
    }
    const day = (await c.query("SELECT to_char(now() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS day")).rows[0].day;
    // Keep the old task's terminal state even if booking its replacement fails.
    await c.query('SAVEPOINT new_attempt');
    try {
      await changeBudget(c,day,10,true);
      const id = randomUUID();
      await c.query("INSERT INTO course_generations(id,owner_id,course_id,status,budget_day,model_provider,model_name) VALUES($1,$2,$3,'queued',$4,$5,$6)",[id,userId,courseId,day,config!.provider,config!.model]);
      await c.query("UPDATE learning_courses SET active_generation=$2,status='queued',error='' WHERE id=$1",[courseId,id]);
      const job = await boss!.send(courseQueue,{ownerId:userId,generationId:id},{ retryLimit:0,expireInSeconds:120,db:{executeSql:(sql,values)=>c.query(sql,values)} });
      if (!job) throw new Error('入队失败');
      return {id};
    } catch(failure) {
      await c.query('ROLLBACK TO SAVEPOINT new_attempt');
      const error=failure instanceof Error && failure.message.startsWith('模型预算') ? failure.message : '后台任务暂时无法提交，未扣除新调用预算，请稍后重试。';
      await c.query("UPDATE learning_courses SET status='failed',error=$2 WHERE id=$1",[courseId,error]);
      return {error};
    }
  });
  if (result.error) throw new Error(result.error); return result.id!;
}
export async function updateSources(userId:string,courseId:string, urls:string) {
  if (!validId(courseId)) throw new Error('找不到这个课程。');
  return withUserDatabase(userId,async c => {
    await lockUser(c,userId);
    const row = (await c.query<Course>('SELECT * FROM learning_courses WHERE id=$1 AND owner_id=$2 FOR UPDATE',[courseId,userId])).rows[0];
    if (!row || !['draft','failed'].includes(row.status)) throw new Error('仅未生成或失败的课程可以补充资料。');
    const goal = validateGoal({...row.goal,sourceUrls:urls});
    await c.query("UPDATE learning_courses SET goal=$2,status='draft',error='' WHERE id=$1",[courseId,JSON.stringify(goal)]);
  });
}
export async function recordDraftFailure(userId:string,courseId:string,error:string) {
  if (!validId(courseId)) return;
  await withUserDatabase(userId,c=>c.query("UPDATE learning_courses SET status='failed',error=$3 WHERE id=$1 AND owner_id=$2 AND status IN('draft','failed')",[courseId,userId,error.slice(0,600)]));
}
export async function beginGeneration(userId:string, generationId:string) {
  return withUserDatabase(userId,async c => {
    await lockUser(c,userId);
    const row = (await c.query('SELECT g.*,c.goal,c.schedule FROM course_generations g JOIN learning_courses c ON c.id=g.course_id WHERE g.id=$1 AND g.owner_id=$2 AND c.active_generation=g.id AND g.status=\'queued\' FOR UPDATE OF c,g',[generationId,userId])).rows[0];
    if (!row) return null;
    await c.query("UPDATE course_generations SET status='running',updated_at=now() WHERE id=$1",[generationId]);
    await c.query("UPDATE learning_courses SET status='running' WHERE id=$1",[row.course_id]);
    return row as {course_id:string;goal:Goal;schedule:DaySlot[];model_provider:string;model_name:string};
  });
}
export async function finishGeneration(userId:string, generationId:string, result:{material?:unknown;sources?:SourceReceipt[];usage?:Usage;pricing?:FreePrice;provenance?:'real'|'simulation';error?:string;unknownCharge?:boolean}) {
  return withUserDatabase(userId,async c => {
    await lockUser(c,userId);
    const row = (await c.query('SELECT g.*,c.goal,c.schedule FROM course_generations g JOIN learning_courses c ON c.id=g.course_id WHERE g.id=$1 AND g.owner_id=$2 AND c.active_generation=g.id FOR UPDATE OF c,g',[generationId,userId])).rows[0];
    if (!row || !['queued','running'].includes(row.status)) return;
    let error = result.error || '', material:Material | undefined;
    if (!error) try { material = validateMaterial(result.material,row.goal,(result.sources || []).map(s=>s.id)); } catch(e) { error=(e as Error).message; }
    const simulated = result.provenance === 'simulation';
    let cost = simulated ? 0 : result.unknownCharge ? row.reserved_fen : 0;
    let billing=simulated?'simulation':result.unknownCharge?'unknown':'estimated';
    if(!simulated&&row.model_provider==='siliconflow'&&!error&&(!result.usage||result.unknownCharge||!validFreePrice(result.pricing,row.model_name))){
      cost=row.reserved_fen;billing='unknown';error='硅基流动免费调用凭据不完整，课程未发布，费用需要核对。';
    }
    if(result.usage&&!simulated){
      validateUsage(result.usage);
      if(row.model_provider==='siliconflow'){
        if(!result.unknownCharge&&validFreePrice(result.pricing,row.model_name)){cost=0;billing='free';}
        else{cost=row.reserved_fen;billing='unknown';error=error||'硅基流动免费价格凭据不完整，课程未发布，费用需要核对。';}
      }else cost=estimateFen(result.usage);
    }
    await settle(c,row,cost,billing,result.usage);
    if(result.pricing)await c.query('UPDATE course_generations SET pricing_receipt=$2 WHERE id=$1',[generationId,JSON.stringify(result.pricing)]);
    await c.query('UPDATE course_generations SET status=$2,updated_at=now() WHERE id=$1',[generationId,error ? 'failed' : 'completed']);
    if (error) await c.query("UPDATE learning_courses SET status='failed',error=$2 WHERE id=$1",[row.course_id,error.slice(0,600)]);
    else await c.query("UPDATE learning_courses SET status='ready',error='',material=$2,sources=$3,schedule=$4,provenance=$5 WHERE id=$1",[row.course_id,JSON.stringify(material),JSON.stringify(result.sources),JSON.stringify(row.schedule.map((day:DaySlot)=>({...day,focus:material!.weeklyTopics[day.week-1]}))),simulated ? 'simulation' : 'real']);
  });
}
export async function saveCourseAttempt(userId:string,courseId:string,key:string,answers:Record<string,unknown>) {
  if (!validId(key) || !validId(courseId)) throw new Error('提交凭证无效。');
  return withUserDatabase(userId,async c => {
    const course = (await c.query<Course>('SELECT * FROM learning_courses WHERE id=$1 AND owner_id=$2 AND status=\'ready\'',[courseId,userId])).rows[0];
    if (!course?.material) throw new Error('课程尚未生成或无权访问。');
    const grade = gradeLesson(course.material.lesson.questions,answers);
    const result = await c.query('INSERT INTO lesson_attempts(id,owner_id,lesson_id,lesson_version,submission_key,score,total,answers,feedback) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner_id,submission_key) DO UPDATE SET submission_key=lesson_attempts.submission_key RETURNING id,score,total,lesson_id,lesson_version',[randomUUID(),userId,`course:${courseId}`,`${course.provenance}:${course.active_generation}`,key,grade.score,grade.total,JSON.stringify(answers),JSON.stringify(grade.feedback)]);
    if(result.rows[0].lesson_id!==`course:${courseId}`||result.rows[0].lesson_version!==`${course.provenance}:${course.active_generation}`)throw new Error('提交凭证已用于其他课堂或版本，请刷新后重试。');
    if(course.provenance==='real')await addReviewCards(c,userId,{lessonId:result.rows[0].id,courseId,label:course.material.title,provenance:'real'},course.material.lesson.questions,course.sources);
    return result.rows[0];
  });
}
