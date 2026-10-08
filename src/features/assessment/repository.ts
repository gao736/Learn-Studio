import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {withUserDatabase} from '../../server/db.ts';
import {validId} from '../course/domain.ts';
import {astronomyPack} from './catalog.ts';
import {addReviewCards} from '../review/repository.ts';
import {mastery,pickQuestions,questionKey,validatePack} from './domain.ts';
import type {Pack,Question,Evidence} from './domain.ts';
type PackRecord={id:string;spec:Pack;status:string;provenance:string;approval_mode?:string};
type Feedback=Evidence&{id:string;prompt:string;chosen:string;explanation:string;sourceIds:string[]};
type Progress=Record<string,ReturnType<typeof mastery>&{weak:string[];prerequisitesMissing:boolean}>;
type Session={id:string;owner_id:string;pack_id:string;pack_version:number;skill_id:string;mode:string;state:string;questions:Question[];help:Record<string,{kind:string;text:string;at:string;events:{kind:string;at:string}[]}>;answers:Record<string,string>;feedback:Feedback[];expires_at:Date;created_at:Date};
async function lock(c:PoolClient,user:string){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,2))',[user]);}
async function packIn(c:PoolClient,user:string,id:string):Promise<PackRecord|null>{
  if(id==='astronomy')return {id,spec:astronomyPack,status:'approved',provenance:'curated'};
  if(!validId(id))return null;
  return (await c.query('SELECT id,spec,status,approval_mode,\'real\' AS provenance FROM assessment_packs WHERE id=$1 AND owner_id=$2',[id,user])).rows[0]??null;
}
export async function getPack(user:string,id:string){return withUserDatabase(user,c=>packIn(c,user,id));}
export async function listPacks(user:string){return withUserDatabase(user,async c=>[{id:'astronomy',spec:astronomyPack,status:'approved',provenance:'curated',approval_mode:'curated'},...(await c.query('SELECT id,spec,status,approval_mode,\'real\' AS provenance FROM assessment_packs WHERE owner_id=$1 ORDER BY created_at DESC',[user])).rows]);}
async function progressIn(c:PoolClient,user:string,pack:PackRecord):Promise<Progress>{
  const sessions=(await c.query<Session>('SELECT * FROM assessment_sessions WHERE owner_id=$1 AND pack_id=$2 AND pack_version=$3 AND state=\'submitted\' ORDER BY created_at,id',[user,pack.id,pack.spec.version])).rows;
  const reviews=(await c.query('SELECT r.* FROM assessment_reviews r JOIN assessment_sessions s ON s.id=r.session_id WHERE s.owner_id=$1 AND s.pack_id=$2 AND s.pack_version=$3',[user,pack.id,pack.spec.version])).rows;
  const progress:Progress=Object.fromEntries(pack.spec.skills.map(skill=>{
    const evidence=sessions.filter(s=>s.skill_id===skill.id).flatMap(s=>s.feedback.map(e=>{
      const review=reviews.find(r=>r.session_id===s.id&&r.question_id===e.id);
      return {...e,pending:review?review.status==='pending':e.pending,correct:review?.status==='resolved'?review.correct:e.correct};
    }));
    const latest=[...new Map(evidence.map(e=>[e.family,e])).values()];
    return [skill.id,{...mastery(evidence,skill.requiresPractice),weak:latest.filter(e=>!e.correct||!e.independent||e.pending).map(e=>e.family),prerequisitesMissing:false}];
  }));
  const resolved=new Set<string>();
  function resolve(id:string):boolean{
    const p=progress[id];if(resolved.has(id))return p.passed;
    p.prerequisitesMissing=!pack.spec.skills.find(s=>s.id===id)!.prerequisites.every(resolve);
    p.passed=p.passed&&!p.prerequisitesMissing;resolved.add(id);return p.passed;
  }
  pack.spec.skills.forEach(s=>resolve(s.id));return progress;
}
export async function getProgress(user:string,id:string):Promise<Progress>{return withUserDatabase(user,async c=>{const p=await packIn(c,user,id);return p?progressIn(c,user,p):{};});}
export async function assessmentHistory(user:string,id:string){return withUserDatabase(user,async c=>(await c.query("SELECT id,skill_id,mode,state,created_at FROM assessment_sessions WHERE owner_id=$1 AND pack_id=$2 ORDER BY created_at DESC LIMIT 20",[user,id])).rows);}
function prerequisites(pack:Pack,skill:string,progress:Awaited<ReturnType<typeof progressIn>>){return pack.skills.find(s=>s.id===skill)?.prerequisites.every(id=>progress[id]?.passed)??false;}
export async function getStudy(user:string,id:string,skill:string){return withUserDatabase(user,async c=>{
  const pack=await packIn(c,user,id);if(!pack||pack.status!=='approved')return null;
  const progress=await progressIn(c,user,pack);if(!prerequisites(pack.spec,skill,progress))return null;
  const lesson=pack.spec.skills.find(s=>s.id===skill);if(!lesson)return null;
  const weak=progress[skill].weak;
  return {pack,skill:lesson,progress:progress[skill],remediation:pack.spec.questions.filter(q=>q.skill===skill&&weak.includes(q.family)).filter((q,i,all)=>all.findIndex(v=>v.family===q.family)===i).map(q=>({family:q.family,text:q.explanation,sourceIds:q.sourceIds}))};
});}
export async function startAssessment(user:string,id:string,skill:string,mode:string){
  if(!['diagnosis','exam','skip'].includes(mode))throw new Error('考核方式无效。');
  return withUserDatabase(user,async c=>{
    await lock(c,user);const pack=await packIn(c,user,id);
    if(!pack||pack.status!=='approved'||!pack.spec.skills.some(s=>s.id===skill))throw new Error('考核题库尚未审核或无权访问。');
    const progress=await progressIn(c,user,pack);
    if(mode==='exam'&&!prerequisites(pack.spec,skill,progress))throw new Error('考核前置技能尚未通过；可先诊断基础或申请跳级测验。');
    await c.query("UPDATE assessment_sessions SET state='expired' WHERE owner_id=$1 AND state='active' AND expires_at<=now()",[user]);
    const active=(await c.query<Session>("SELECT * FROM assessment_sessions WHERE owner_id=$1 AND pack_id=$2 AND pack_version=$3 AND skill_id=$4 AND state='active'",[user,id,pack.spec.version,skill])).rows[0];
    if(active)return active;
    const used=(await c.query<{questions:Question[]}>('SELECT questions FROM assessment_sessions WHERE owner_id=$1',[user])).rows.flatMap(s=>s.questions.map(questionKey));
    const oldFeedback=(await c.query<{feedback:{prompt:string}[]}>('SELECT feedback FROM lesson_attempts WHERE owner_id=$1',[user])).rows;
    used.push(...oldFeedback.flatMap(s=>s.feedback.map(q=>questionKey(q as Question))));
    const questions=pickQuestions(pack.spec,skill,used);
    if(questions.length!==5)throw new Error('考核新题不足五个不同题族，需补充题库；反复提交旧题不会增加证据。');
    return (await c.query<Session>('INSERT INTO assessment_sessions(id,owner_id,pack_id,pack_version,skill_id,mode,questions) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),user,id,pack.spec.version,skill,mode,JSON.stringify(questions)])).rows[0];
  });
}
async function ownSession(c:PoolClient,user:string,id:string,update=false){
  if(!validId(id))throw new Error('找不到这个考核。');
  const s=(await c.query<Session>(`SELECT * FROM assessment_sessions WHERE id=$1 AND owner_id=$2${update?' FOR UPDATE':''}`,[id,user])).rows[0];
  if(!s)throw new Error('找不到这个考核。');return s;
}
function active(s:Session){if(s.state!=='active'||new Date(s.expires_at).getTime()<=Date.now())throw new Error('考核已提交或过期，请返回技能页申请新题。');}
export async function requestHelp(user:string,id:string,qid:string,kind:string){
  if(!['hint','answer'].includes(kind))throw new Error('考核帮助方式无效。');
  return withUserDatabase(user,async c=>{
    await lock(c,user);const s=await ownSession(c,user,id,true);active(s);
    const q=s.questions.find(q=>q.id===qid);if(!q)throw new Error('考核题目不存在。');
    const text=kind==='hint'?q.hint:q.type==='choice'?`答案：${q.options![q.correctIndex!]}。${q.explanation}`:q.explanation;
    const at=new Date().toISOString(), previous=s.help[qid]?.events||[];
    const events=previous.some(e=>e.kind===kind)?previous:[...previous,{kind,at}];
    const help={...s.help,[qid]:{kind,text,at,events}};
    await c.query('UPDATE assessment_sessions SET help=$2 WHERE id=$1',[id,JSON.stringify(help)]);
    return text;
  });
}
export async function submitAssessment(user:string,id:string,answers:Record<string,unknown>){
  return withUserDatabase(user,async c=>{
    await lock(c,user);const s=await ownSession(c,user,id,true);
    if(s.state==='submitted')return s;active(s);
    const pack=await packIn(c,user,s.pack_id);
    if(!pack||pack.status!=='approved'||pack.spec.version!==s.pack_version)throw new Error('考核版本发生变化，请重新开始。');
    if(s.mode==='exam'&&!prerequisites(pack.spec,s.skill_id,await progressIn(c,user,pack)))throw new Error('考核前置技能需要处理复核或补习后才能提交。');
    const saved:Record<string,string>={};
    const feedback:Feedback[]=s.questions.map(q=>{
      const a=answers[q.id];
      if(typeof a!=='string'||!a.trim()||a.length>1800||(q.type==='choice'&&(!/^\d+$/.test(a)||!Number.isSafeInteger(Number(a))||Number(a)>=q.options!.length)))throw new Error('考核请完成所有问题并提供有效答案。');
      saved[q.id]=a.trim();
      return {id:q.id,prompt:q.prompt,family:q.family,chosen:q.type==='choice'?q.options![Number(a)]:a.trim(),correct:q.type==='choice'?Number(a)===q.correctIndex:null,independent:!s.help[q.id],pending:q.type==='written',explanation:q.explanation,sourceIds:q.sourceIds};
    });
    const row=(await c.query<Session>("UPDATE assessment_sessions SET state='submitted',answers=$2,feedback=$3,submitted_at=now() WHERE id=$1 RETURNING *",[id,JSON.stringify(saved),JSON.stringify(feedback)])).rows[0];
    for(const q of feedback.filter(q=>q.pending))await c.query('INSERT INTO assessment_reviews(id,owner_id,session_id,question_id,reason) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user,id,q.id,'短答评分不确定，需要按评分依据人工核对。']);
    const courseId=s.pack_id==='astronomy'?undefined:(await c.query('SELECT course_id FROM assessment_packs WHERE id=$1 AND owner_id=$2',[s.pack_id,user])).rows[0]?.course_id;
    await addReviewCards(c,user,{sessionId:s.id,courseId,label:pack.spec.title,provenance:s.pack_id==='astronomy'?'curated':'real'},s.questions.filter(q=>q.type==='choice') as (Question&{options:string[];correctIndex:number})[],pack.spec.sources);
    return row;
  });
}
export async function getAssessment(user:string,id:string){
  if(!validId(id))return null;
  return withUserDatabase(user,async c=>{
    const s=(await c.query<Session>('SELECT * FROM assessment_sessions WHERE id=$1 AND owner_id=$2',[id,user])).rows[0];if(!s)return null;
    const reviews=(await c.query('SELECT id,question_id,status,correct,rationale,resolved_at FROM assessment_reviews WHERE session_id=$1 AND owner_id=$2',[id,user])).rows;
    return {id:s.id,packId:s.pack_id,skillId:s.skill_id,mode:s.mode,state:s.state==='active'&&new Date(s.expires_at).getTime()<=Date.now()?'expired':s.state,
      questions:s.questions.map(({id,prompt,options,type})=>({id,prompt,options,type})),help:s.help,feedback:s.state==='submitted'?s.feedback:[],reviews,expiresAt:s.expires_at};
  });
}
export async function requestReview(user:string,id:string,qid:string,reason:string){
  if(typeof reason!=='string'||reason.trim().length<5||reason.length>1500)throw new Error('复核请说明至少五个字的具体原因。');
  return withUserDatabase(user,async c=>{
    await lock(c,user);const s=await ownSession(c,user,id,true);
    if(s.state!=='submitted'||!s.feedback.some(q=>q.id===qid))throw new Error('复核只能针对已保存的答题。');
    const existing=(await c.query('SELECT * FROM assessment_reviews WHERE session_id=$1 AND question_id=$2 AND owner_id=$3',[id,qid,user])).rows[0];
    if(existing)return existing;
    return (await c.query('INSERT INTO assessment_reviews(id,owner_id,session_id,question_id,reason) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),user,id,qid,reason.trim()])).rows[0];
  });
}
async function reviewer(c:PoolClient){return (await c.query('SELECT is_assessment_reviewer() AS allowed')).rows[0].allowed===true;}
export async function isReviewer(user:string){return withUserDatabase(user,reviewer);}
export async function resolveReview(user:string,id:string,correct:boolean,rationale:string){
  if(!validId(id)||typeof correct!=='boolean'||typeof rationale!=='string'||rationale.trim().length<5||rationale.length>1500)throw new Error('复核决定与依据无效。');
  return withUserDatabase(user,async c=>{
    if(!await reviewer(c))throw new Error('复核权限不足。');
    const r=(await c.query('SELECT * FROM assessment_reviews WHERE id=$1',[id])).rows[0];if(!r)throw new Error('复核记录不存在。');
    if(r.owner_id===user)throw new Error('复核不能处理自己的作答。');
    await lock(c,r.owner_id);
    const current=(await c.query('SELECT * FROM assessment_reviews WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(current.status==='resolved')return current;
    return (await c.query("UPDATE assessment_reviews SET status='resolved',correct=$2,reviewer_id=$3,rationale=$4,resolved_at=now() WHERE id=$1 AND status='pending' RETURNING *",[id,correct,user,rationale.trim()])).rows[0]??r;
  });
}
export async function createCandidate(user:string,courseId:string){
  if(!validId(courseId))throw new Error('找不到这个课程。');
  return withUserDatabase(user,async c=>{
    await lock(c,user);
    const course=(await c.query("SELECT * FROM learning_courses WHERE id=$1 AND owner_id=$2 AND status='ready' AND provenance='real'",[courseId,user])).rows[0];
    if(!course)throw new Error('考核仅可申请真实生成且有权限的课程，模拟课程不计能力。');
    const existing=(await c.query('SELECT id FROM assessment_packs WHERE owner_id=$1 AND course_id=$2',[user,courseId])).rows[0];
    if(existing)return existing.id;
    const lesson=course.material.lesson;
    const spec:Pack={title:course.material.title,version:1,sources:course.sources,skills:[{id:'intro',title:lesson.title,lesson:lesson.sections.map((s:any)=>`${s.heading}：${s.body}`).join('\n'),sourceIds:[...new Set<string>(lesson.sections.flatMap((s:any)=>s.sourceIds))],prerequisites:[],requiresPractice:false}],questions:lesson.questions.map((q:any)=>({...q,skill:'intro',family:'',hint:q.explanation,type:'choice'}))};
    return (await c.query("INSERT INTO assessment_packs(id,owner_id,course_id,spec,blocked_keys) VALUES($1,$2,$3,$4,$5) RETURNING id",[randomUUID(),user,courseId,JSON.stringify(spec),JSON.stringify(spec.questions.map(questionKey))])).rows[0].id;
  });
}
export async function publishPack(user:string,id:string,raw:unknown,rationale:string){
  if(!validId(id)||rationale.trim().length<5||rationale.length>1500)throw new Error('复核题库说明无效。');
  return withUserDatabase(user,async c=>{
    if(!await reviewer(c))throw new Error('复核权限不足。');
    const row=(await c.query('SELECT * FROM assessment_packs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!row||row.owner_id===user)throw new Error('复核不能批准自己的题库或不存在的题库。');
    if(row.status==='approved')return;
    const spec=validatePack(raw);
    const blocked=new Set([...row.blocked_keys,...row.spec.questions.map(questionKey)]);
    if(spec.questions.some(q=>blocked.has(questionKey(q))))throw new Error('考核原课练习不能重新充当独立新题，请补充诊断与补测题。');
    await c.query("UPDATE assessment_packs SET spec=$2,status='approved',reviewer_id=$3,rationale=$4,approved_at=now() WHERE id=$1",[id,JSON.stringify(spec),user,rationale.trim()]);
  });
}
export async function reviewWork(user:string){return withUserDatabase(user,async c=>{
  if(!await reviewer(c))throw new Error('复核权限不足。');
  const reviews=(await c.query("SELECT r.*,s.questions,s.answers,s.pack_id FROM assessment_reviews r JOIN assessment_sessions s ON s.id=r.session_id WHERE r.status='pending' AND r.owner_id<>$1 ORDER BY r.created_at LIMIT 100",[user])).rows;
  for(const r of reviews){const p=r.pack_id==='astronomy'?astronomyPack:(await c.query('SELECT spec FROM assessment_packs WHERE id=$1',[r.pack_id])).rows[0]?.spec;r.sources=p?.sources||[];}
  const packs=(await c.query("SELECT * FROM assessment_packs WHERE status='pending' AND owner_id<>$1 ORDER BY created_at LIMIT 30",[user])).rows;
  return {reviews,packs};
});}
