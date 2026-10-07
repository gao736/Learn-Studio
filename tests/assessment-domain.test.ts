import test from 'node:test';
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
