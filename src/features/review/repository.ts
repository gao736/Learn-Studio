import {randomUUID} from 'node:crypto';
import {createEmptyCard} from 'ts-fsrs';
import type {CardInput} from 'ts-fsrs';
import type {PoolClient} from 'pg';
import {withUserDatabase} from '../../server/db.ts';
import {validId,courseVersion} from '../course/domain.ts';
import type {Course} from '../course/repository.ts';
import {questionKey} from '../assessment/domain.ts';
import {astronomyPack} from '../assessment/catalog.ts';
import {questions as astronomyQuestions} from '../lesson/quiz.ts';
import {algorithm,reviewParameters,scheduleReview} from './domain.ts';
import type {ReviewQuestion} from './domain.ts';
type Card={id:string;owner_id:string;question:ReviewQuestion;question_id:string;label:string;provenance:string;memory:CardInput;due:Date;revision:number;session_id:string|null;paused:boolean};
type Feedback={correct:boolean;chosen:string;correctAnswer:string;explanation:string;sources:ReviewQuestion['sources'];rating:number;due:string};
type Attempt={id:string;card_id:string;revision:number;state:string;feedback:Feedback|null;submitted_at:Date|null};
type Due={id:string;label:string;provenance:string;due:Date;revision:number;session_id:string|null;prompt:string};
type History={id:string;card_id:string;feedback:Feedback;submitted_at:Date;label:string};
type Origin={lessonId?:string;sessionId?:string;courseId?:string;label:string;provenance:'curated'|'real'};
type Question=Omit<ReviewQuestion,'sources'>&{id:string;type?:string;sourceIds?:string[]};
const disputed="EXISTS(SELECT 1 FROM assessment_reviews r WHERE r.session_id=c.session_id AND r.question_id=c.question_id)";
export const astronomySources=[{title:'NASA Science: Stars',url:'https://science.nasa.gov/universe/stars/'},{title:'NASA Science: Planets',url:'https://science.nasa.gov/solar-system/planets/'},{title:'NASA Science: Moon',url:'https://science.nasa.gov/moon/'}];
export async function addReviewCards(c:PoolClient,user:string,origin:Origin,questions:Question[],sources:{id?:string;title:string;url:string}[]){
  let added=0;const now=new Date();
  for(const q of questions){
    if(q.type==='written')continue;
    const question:ReviewQuestion={prompt:q.prompt,options:q.options,correctIndex:q.correctIndex,explanation:q.explanation,sources:sources.filter(s=>!q.sourceIds||q.sourceIds.includes(s.id!)).map(({title,url})=>({title,url}))};
    added+=(await c.query('INSERT INTO review_cards(id,owner_id,fingerprint,question,question_id,label,provenance,lesson_attempt_id,session_id,course_id,memory,due) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(owner_id,fingerprint) DO NOTHING',[randomUUID(),user,questionKey(q),JSON.stringify(question),q.id,origin.label,origin.provenance,origin.lessonId??null,origin.sessionId??null,origin.courseId??null,JSON.stringify(createEmptyCard(now)),now])).rowCount!;
  }
  return added;
}
export async function syncReviews(user:string){return withUserDatabase(user,async c=>{
  let added=0,skipped=0;
  // ponytail: per-account history scan; paginate if a real user's history makes this slow.
  const lessons=(await c.query('SELECT * FROM lesson_attempts WHERE owner_id=$1 ORDER BY created_at,id',[user])).rows;
  for(const a of lessons){
    if(a.lesson_id==='astronomy')added+=await addReviewCards(c,user,{lessonId:a.id,label:'天文学 · 恒星、行星与卫星',provenance:'curated'},astronomyQuestions,astronomySources);
    else if(a.lesson_id.startsWith('course:')&&a.lesson_version.startsWith('real:')){
      const course=(await c.query<Course>('SELECT * FROM learning_courses WHERE id=$1 AND owner_id=$2 AND status=\'ready\' AND provenance=\'real\'',[a.lesson_id.slice(7),user])).rows[0];
      if(!course?.material){skipped++;continue;}
      const snapshot=a.lesson_version===courseVersion(course)?course:(await c.query<Pick<Course,'material'|'sources'>>('SELECT material,sources FROM course_material_versions WHERE course_id=$1 AND owner_id=$2 AND version=$3',[course.id,user,a.lesson_version])).rows[0];
      if(!snapshot?.material){skipped++;continue;}
      const questions=snapshot.material.lesson.questions.filter(q=>a.feedback.some((e:{prompt:string;correctAnswer:string})=>e.prompt===q.prompt&&e.correctAnswer===q.options[q.correctIndex]));
      added+=await addReviewCards(c,user,{lessonId:a.id,courseId:course.id,label:snapshot.material.title,provenance:'real'},questions,snapshot.sources);
    }else skipped++;
  }
  const sessions=(await c.query("SELECT * FROM assessment_sessions WHERE owner_id=$1 AND state='submitted' ORDER BY created_at,id",[user])).rows;
  for(const s of sessions){
    const p=s.pack_id==='astronomy'?{spec:astronomyPack,course_id:null,status:'approved'}:(await c.query('SELECT spec,course_id,status FROM assessment_packs WHERE id=$1 AND owner_id=$2',[s.pack_id,user])).rows[0];
    if(!p||p.status!=='approved'||p.spec.version!==s.pack_version){skipped++;continue;}
    const questions=s.questions.filter((q:Question)=>q.type==='choice');skipped+=s.questions.length-questions.length;
    added+=await addReviewCards(c,user,{sessionId:s.id,courseId:p.course_id??undefined,label:p.spec.title,provenance:s.pack_id==='astronomy'?'curated':'real'},questions,p.spec.sources);
  }
  return {added,skipped};
});}
export async function listReviews(user:string){return withUserDatabase(user,async c=>{
  const counts=(await c.query<{total:number;paused:number;next_due:Date|null}>(`SELECT count(*)::int AS total,count(*) FILTER(WHERE ${disputed})::int AS paused,min(due) FILTER(WHERE NOT ${disputed} AND due>now()) AS next_due FROM review_cards c WHERE owner_id=$1`,[user])).rows[0];
  const due=(await c.query<Due>(`SELECT id,label,provenance,due,revision,session_id,question->>'prompt' AS prompt FROM review_cards c WHERE owner_id=$1 AND due<=now() AND NOT ${disputed} ORDER BY due,id LIMIT 50`,[user])).rows;
  const history=(await c.query<History>("SELECT a.id,a.card_id,a.feedback,a.submitted_at,c.label FROM review_attempts a JOIN review_cards c ON c.id=a.card_id WHERE a.owner_id=$1 AND a.state='submitted' ORDER BY a.submitted_at DESC,a.id LIMIT 20",[user])).rows;
  return {...counts,due,history};
});}
async function ownCard(c:PoolClient,user:string,id:string,update=false){
  if(!validId(id))throw new Error('找不到这个复习任务。');
  const row=(await c.query<Card>(`SELECT c.*,${disputed} AS paused FROM review_cards c WHERE id=$1 AND owner_id=$2${update?' FOR UPDATE OF c':''}`,[id,user])).rows[0];
  if(!row)throw new Error('找不到这个复习任务。');return row;
}
function available(card:Card,now:Date){if(card.paused)throw new Error('复习题已有评分复核，需核对题库后再安排；当前题目暂停。');if(new Date(card.due)>now)throw new Error('复习尚未到期，请按计划时间再来。');}
export async function startReview(user:string,id:string){return withUserDatabase(user,async c=>{
  const card=await ownCard(c,user,id,true);available(card,new Date());
  const existing=(await c.query<Attempt>('SELECT id FROM review_attempts WHERE card_id=$1 AND owner_id=$2 AND revision=$3',[id,user,card.revision])).rows[0];if(existing)return existing.id;
  const attempt=randomUUID();await c.query('INSERT INTO review_attempts(id,owner_id,card_id,revision) VALUES($1,$2,$3,$4)',[attempt,user,id,card.revision]);return attempt;
});}
async function ownAttempt(c:PoolClient,user:string,id:string,update=false){
  if(!validId(id))throw new Error('找不到这次复习。');
  const a=(await c.query<Attempt>(`SELECT * FROM review_attempts WHERE id=$1 AND owner_id=$2${update?' FOR UPDATE':''}`,[id,user])).rows[0];if(!a)throw new Error('找不到这次复习。');return a;
}
export async function getReview(user:string,id:string){
  if(!validId(id))return null;
  return withUserDatabase(user,async c=>{
    const a=(await c.query<Attempt>('SELECT * FROM review_attempts WHERE id=$1 AND owner_id=$2',[id,user])).rows[0];if(!a)return null;
    const card=await ownCard(c,user,a.card_id);
    return {id:a.id,cardId:a.card_id,state:a.state,label:card.label,provenance:card.provenance,paused:card.paused,question:{prompt:card.question.prompt,options:card.question.options},feedback:a.state==='submitted'?a.feedback:null,submittedAt:a.submitted_at};
  });
}
export async function submitReview(user:string,id:string,answer:unknown,difficulty:unknown){return withUserDatabase(user,async c=>{
  const a=await ownAttempt(c,user,id,true);if(a.state==='submitted')return {...a,feedback:a.feedback!};
  const card=await ownCard(c,user,a.card_id,true),now=new Date();available(card,now);
  if(a.revision!==card.revision)throw new Error('复习版本已更新，请返回复习页继续。');
  const result=scheduleReview(card.question,card.memory,answer,difficulty,now);
  const feedback:Feedback={correct:result.correct,chosen:card.question.options[Number(answer)],correctAnswer:card.question.options[card.question.correctIndex],explanation:card.question.explanation,sources:card.question.sources,rating:result.rating,due:result.scheduled.card.due.toISOString()};
  await c.query('UPDATE review_cards SET memory=$2,due=$3,revision=revision+1 WHERE id=$1',[card.id,JSON.stringify(result.scheduled.card),result.scheduled.card.due]);
  return (await c.query<Attempt>("UPDATE review_attempts SET state='submitted',answer=$2,self_rating=$3,feedback=$4,before_memory=$5,after_memory=$6,fsrs_log=$7,parameters=$8,algorithm=$9,submitted_at=$10 WHERE id=$1 RETURNING *",[id,answer,difficulty,JSON.stringify(feedback),JSON.stringify(card.memory),JSON.stringify(result.scheduled.card),JSON.stringify(result.scheduled.log),JSON.stringify(reviewParameters),algorithm,now])).rows[0] as Attempt&{feedback:Feedback};
});}
