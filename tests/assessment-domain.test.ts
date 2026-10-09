import test from 'node:test';
import {validateAIReport} from '../src/features/assessment/domain.ts';
import assert from 'node:assert/strict';
import { mastery, pickQuestions, validatePack, questionKey } from '../src/features/assessment/domain.ts';
import { astronomyPack } from '../src/features/assessment/catalog.ts';

test('unlock needs four correct independent families out of five and required practice', () => {
  const evidence=Array.from({length:5},(_,i)=>({family:`f${i}`,correct:i!==4,independent:true,pending:false}));
  assert.deepEqual(mastery(evidence,false),{estimate:.8,families:5,correct:4,pending:false,passed:true,practiceMissing:false});
  assert.equal(mastery(evidence,true).passed,false);
  assert.equal(mastery(evidence.slice(0,4),false).passed,false);
  assert.equal(mastery(evidence.map(e=>({...e,independent:false})),false).passed,false);
});

test('AI check fails closed on unsupported, missing, invented and mismatched evidence',()=>{
  const pack=structuredClone(astronomyPack);pack.questions=pack.questions.filter(q=>q.type==='choice');
  const sources=pack.sources.map(s=>({...s,text:'A supported statement about stars.'}));
  const report={familiesValid:true,prerequisitesValid:true,skills:pack.skills.map(s=>({id:s.id,verdict:'supported',sourceId:s.sourceIds[0],quote:'supported statement'})),questions:pack.questions.map(q=>({id:q.id,verdict:'supported',correctIndex:q.correctIndex,correctOptionText:q.options![q.correctIndex!],sourceId:q.sourceIds[0],quote:'supported statement'}))};
  assert.doesNotThrow(()=>validateAIReport(pack,report,sources,[]));
  for(const mutate of [(r:any)=>r.questions.pop(),(r:any)=>r.questions[0].verdict='uncertain',(r:any)=>r.questions[0].quote='invented quotation',(r:any)=>r.questions[0].correctIndex=99,(r:any)=>r.familiesValid=false,(r:any)=>r.skills[0].sourceId='other']){
    const bad=structuredClone(report);mutate(bad);assert.throws(()=>validateAIReport(pack,bad,sources,[]),/考核/);
  }
  assert.throws(()=>validateAIReport(pack,report,sources,[questionKey(pack.questions[0])]),/重复|原课/);
  assert.throws(()=>validateAIReport(pack,{...report,familiesValid:false},sources,[]),/题族/);
  assert.throws(()=>validateAIReport(pack,{...report,prerequisitesValid:false},sources,[]),/前置/);
  const wrongText=structuredClone(report);wrongText.questions[0].correctOptionText='wrong option text';assert.throws(()=>validateAIReport(pack,wrongText,sources,[]),/考核/);
  const punctuation=structuredClone(report);for(const item of [...punctuation.skills,...punctuation.questions])item.quote="stars' gas is hot.";
  assert.doesNotThrow(()=>validateAIReport(pack,punctuation,sources.map(s=>({...s,text:'The stars’ gas is hot.'})),[]));
  for(const quote of ['            ','stars       ']){const empty=structuredClone(report);empty.questions[0].quote=quote;assert.throws(()=>validateAIReport(pack,empty,sources,[]),/考核/);}
  const linkText=structuredClone(report);for(const item of [...linkText.skills,...linkText.questions])item.quote='a neutron star or a black hole.';
  assert.doesNotThrow(()=>validateAIReport(pack,linkText,sources.map(s=>({...s,text:'either a neutron star or a black hole .'})),[]));
});
test('repeated families and pending review never manufacture mastery', () => {
  const repeated=Array.from({length:10},()=>({family:'same',correct:true,independent:true,pending:false}));
  assert.equal(mastery(repeated,false).families,1);
  assert.equal(mastery(repeated,false).passed,false);
  const fresh=Array.from({length:5},(_,i)=>({family:`f${i}`,correct:true,independent:true,pending:false}));
  assert.equal(mastery([...fresh,{family:'f0',correct:false,independent:true,pending:false}],false).estimate,.8);
  assert.equal(mastery([...fresh,{family:'f1',correct:null,independent:true,pending:true}],false).passed,false);
});
test('fresh assessment selects distinct families and rejects reuse across reordered options', () => {
  const pack=validatePack(astronomyPack);
  const first=pickQuestions(pack,'light',[]);
  assert.equal(first.length,5);assert.equal(new Set(first.map(q=>q.family)).size,5);
  const next=pickQuestions(pack,'light',first.map(questionKey));
  assert.equal(next.length,5);assert.ok(next.every(q=>!first.some(old=>questionKey(old)===questionKey(q))));
  assert.equal(questionKey({...first[0],options:[...first[0].options!].reverse()}),questionKey(first[0]));
  assert.equal(questionKey({...first[0],options:['新干扰项','内部核聚变','另外的干扰项']}),questionKey(first[0]));
});
test('copying exposed first-round answer positions cannot pass either retest round',()=>{
  const oldPositions=[1,0,2,1,0];
  for(const round of [2,3]){
    const qs=astronomyPack.questions.filter(q=>q.skill==='light'&&q.id.endsWith(`-${round}`));
    assert.ok(qs.filter((q,i)=>q.correctIndex===oldPositions[i]).length<4);
  }
  assert.ok(!astronomyPack.questions.some(q=>q.prompt.includes('我们最近的一颗恒星是太阳')));
});
test('pack approval rejects prerequisite cycles and missing independent retest families', () => {
  const cycle=structuredClone(astronomyPack);cycle.skills[0].prerequisites=['life'];
  assert.throws(()=>validatePack(cycle),/前置/);
  const thin=structuredClone(astronomyPack);thin.questions=thin.questions.filter(q=>q.skill!=='light'||q.id===thin.questions[0].id);
  assert.throws(()=>validatePack(thin),/题族|补测/);
  const missingSource=structuredClone(astronomyPack);missingSource.questions[0].sourceIds=['unknown'];
  assert.throws(()=>validatePack(missingSource),/来源/);
});
