import { createHash } from 'node:crypto';
import { safeSourceURL } from '../course/domain.ts';
export type Question={id:string;skill:string;family:string;type:'choice'|'written';prompt:string;options?:string[];correctIndex?:number;hint:string;explanation:string;sourceIds:string[]};
export type Skill={id:string;title:string;prerequisites:string[];requiresPractice:boolean;lesson:string;sourceIds:string[]};
export type Pack={title:string;version:number;sources:{id:string;title:string;url:string}[];skills:Skill[];questions:Question[]};
export type Evidence={family:string;correct:boolean|null;independent:boolean;pending:boolean};
export function mastery(evidence:Evidence[],requiresPractice:boolean) {
  const latest=new Map<string,Evidence>();
  for (const e of evidence) if(e.independent && !e.pending && typeof e.correct==='boolean') {latest.delete(e.family);latest.set(e.family,e);}
  const recent=[...latest.values()].slice(-5), correct=recent.filter(e=>e.correct).length;
  const pending=evidence.some(e=>e.pending), estimate=correct/5;
  // ponytail: observed independent family ratio, not a calibrated probability; practical verification comes from M07+.
  return {estimate,families:recent.length,correct,pending,passed:recent.length===5&&estimate>=.8&&!pending&&!requiresPractice,practiceMissing:requiresPractice};
}
export function questionKey<T extends {prompt:string}>(q:T) {
  return createHash('sha256').update(q.prompt.normalize('NFKC').replace(/\s+/g,'').toLowerCase()).digest('hex');
}
export function pickQuestions(pack:Pack,skill:string,used:string[]):Question[] {
  const taken=new Set(used), families=new Set<string>();
  return pack.questions.filter(q=>{
    if(q.skill!==skill || taken.has(questionKey(q)) || families.has(q.family)) return false;
    families.add(q.family);return true;
  }).slice(0,5);
}
function text(value:unknown,label:string,max:number) {
  if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`考核${label}缺失或过长。`);
  return value.trim();
}
export function validatePack(raw:unknown):Pack {
  if(!raw||typeof raw!=='object'||Buffer.byteLength(JSON.stringify(raw))>500000)throw new Error('考核题库格式或大小无效。');
  const p=raw as Pack, identifier=(v:string)=>typeof v==='string'&&/^[a-z0-9-]{1,60}$/i.test(v);
  text(p.title,'标题',150);
  if(!Number.isInteger(p.version)||p.version<1||!Array.isArray(p.sources)||p.sources.length<1||p.sources.length>10||!Array.isArray(p.skills)||!p.skills.length||p.skills.length>20||!Array.isArray(p.questions)||p.questions.length>3000)throw new Error('考核题库结构无效。');
  const sources=new Set(p.sources.map(s=>{if(!identifier(s.id))throw new Error('考核来源标识无效。');text(s.title,'来源标题',200);safeSourceURL(s.url);return s.id;}));
  if(sources.size!==p.sources.length)throw new Error('考核来源重复。');
  const citations=(ids:string[])=>{if(!Array.isArray(ids)||!ids.length||ids.length>10||ids.some(id=>!sources.has(id)))throw new Error('考核来源缺失或无效。');};
  const skills=new Map(p.skills.map(s=>[s.id,s]));
  if(skills.size!==p.skills.length)throw new Error('考核技能标识重复。');
  for(const s of p.skills){if(!identifier(s.id)||typeof s.requiresPractice!=='boolean'||!Array.isArray(s.prerequisites)||s.prerequisites.some(id=>!skills.has(id)))throw new Error('考核前置技能无效。');text(s.title,'技能标题',150);text(s.lesson,'教学正文',9000);citations(s.sourceIds);}
  const visited=new Set<string>(), visiting=new Set<string>();
  function visit(id:string){if(visiting.has(id))throw new Error('考核前置技能存在循环。');if(visited.has(id))return;visiting.add(id);skills.get(id)!.prerequisites.forEach(visit);visiting.delete(id);visited.add(id);}
  p.skills.forEach(s=>visit(s.id));
  const ids=new Set<string>(), keys=new Set<string>();
  for(const q of p.questions){
    if(!identifier(q.id)||!identifier(q.family)||!skills.has(q.skill)||ids.has(q.id))throw new Error('考核题族或题目标识无效。');
    ids.add(q.id);text(q.prompt,'问题',1000);text(q.hint,'提示',1500);text(q.explanation,'评分依据',2000);citations(q.sourceIds);
    if(q.type==='choice'){if(!Array.isArray(q.options)||q.options.length<3||q.options.length>4||q.options.some(v=>typeof v!=='string'||!v.trim()||v.length>500)||new Set(q.options).size!==q.options.length||!Number.isInteger(q.correctIndex)||q.correctIndex!<0||q.correctIndex!>=q.options.length)throw new Error('考核选项或答案无效。');}
    else if(q.type!=='written'||q.options!=null||q.correctIndex!=null)throw new Error('考核题型无效。');
    const key=questionKey(q);if(keys.has(key))throw new Error('考核题目重复，不能充当新题。');keys.add(key);
  }
  for(const s of p.skills){const families=new Map<string,number>();p.questions.filter(q=>q.skill===s.id).forEach(q=>families.set(q.family,(families.get(q.family)||0)+1));if(families.size<5||[...families.values()].some(n=>n<2))throw new Error('考核每个技能至少需要五个题族，每族至少两道独立补测题。');}
  return p;
}
