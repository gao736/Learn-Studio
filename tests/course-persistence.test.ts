import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtureMaterial } from './fixtures/course.ts';
import {fixtureModel,fixturePricing} from './fixtures/siliconflow.ts';
process.loadEnvFile('.env.local');
process.env.COURSE_QUEUE = `test-course-${randomUUID()}`;
process.env.SILICONFLOW_API_KEY = 'local-integration-not-a-real-key';
process.env.SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';process.env.SILICONFLOW_MODEL=fixtureModel;
const { pool, withUserDatabase } = await import('../src/server/db.ts');
const { getBoss, courseQueue } = await import('../src/server/queue.ts');
const { createCourse, getCourse, requestGeneration, beginGeneration, finishGeneration, saveCourseAttempt, reviseCourse, getCourseMaterial } = await import('../src/features/course/repository.ts');
const { runGeneration } = await import('../src/features/course/generate.ts');

test('PostgreSQL course workflow isolates users, queues transactionally and recovers without double charges', async t => {
  const ids = [randomUUID(), randomUUID()];
  const boss = await getBoss();
  t.after(async () => {
    for (const id of ids) {
      await withUserDatabase(id, async client => {
        const bills = await client.query('SELECT budget_day, sum(accounted_fen)::int AS amount FROM course_generations WHERE owner_id=$1 GROUP BY budget_day', [id]);
        for (const bill of bills.rows) {
          await client.query('UPDATE model_budgets SET used_fen=used_fen-$1 WHERE period=ANY($2::text[])', [bill.amount, [`day:${bill.budget_day}`,`month:${bill.budget_day.slice(0,7)}`]]);
        }
        await client.query('DELETE FROM "user" WHERE id=$1', [id]);
      });
    }
    await boss.deleteQueue(courseQueue); await boss.stop(); await pool.end();
  });
  assert.equal(typeof reviseCourse,'function','source corrections must preserve the original course version');
  for (const id of ids) await pool.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())',[id,'M02验收账户',`${id}@example.test`]);
  const input = { topic:'天文学', days:7, dailyMinutes:30, startDate:'2026-10-06' };
  const key = randomUUID();
  const races = await Promise.allSettled([createCourse(ids[0], key, input), createCourse(ids[0],randomUUID(),input)]);
  assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
  const course = (races.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
  assert.equal((await createCourse(ids[0], course.submission_key, input)).id, course.id);
  assert.equal(await getCourse(ids[1],course.id), null);
  const bypass = await withUserDatabase(ids[1], c => c.query('SELECT id FROM learning_courses WHERE id=$1',[course.id]));
  assert.equal(bypass.rowCount,0);
  await assert.rejects(requestGeneration(ids[1],course.id));
  const calls = await Promise.all([requestGeneration(ids[0],course.id),requestGeneration(ids[0],course.id)]);
  assert.equal(calls[0],calls[1]);
  const queued = await boss.fetch<{generationId:string}>(courseQueue);
  assert.equal(queued.length,1); assert.equal(queued[0].data.generationId,calls[0]);
  assert.equal((await getCourse(ids[0],course.id))?.status,'queued');
  const snapshot=(await withUserDatabase(ids[0],c=>c.query('SELECT * FROM course_generations WHERE id=$1',[calls[0]]))).rows[0];
  assert.equal(snapshot.model_provider,'siliconflow');assert.equal(snapshot.model_name,fixtureModel);
  assert.ok(await beginGeneration(ids[0],calls[0]));
  const receipts = [{id:'s1',url:'https://science.nasa.gov/universe/stars/',title:'模拟来源',fetchedAt:new Date().toISOString(),digest:'simulation'},{id:'s2',url:'https://science.nasa.gov/universe/stars/',title:'第二模拟来源',fetchedAt:new Date().toISOString(),digest:'simulation-2'}];
  await finishGeneration(ids[0],calls[0],{ material:fixtureMaterial, sources:receipts, usage:{inputTokens:0,outputTokens:0}, provenance:'simulation' });
  await finishGeneration(ids[0],calls[0],{error:'late duplicate',unknownCharge:true});
  assert.equal((await getCourse(ids[0],course.id))?.status,'ready');
  const answers = {q1:'1',q2:'0',q3:'2',q4:'1',q5:'0'};
  const attemptKey = randomUUID();
  const result = await saveCourseAttempt(ids[0],course.id,attemptKey,answers);
  assert.equal(result.score,5);
  assert.equal((await saveCourseAttempt(ids[0],course.id,attemptKey,{...answers,q1:'0'})).id,result.id);
  await assert.rejects(saveCourseAttempt(ids[1],course.id,randomUUID(),answers));
  const originalVersion=`simulation:${calls[0]}`;
  const revised=structuredClone(fixtureMaterial);
  revised.lesson.sections.push({heading:'补充讲解',body:'按原来源补充先前遗漏的概念。',sourceIds:['s1']});
  revised.lesson.questions[4].prompt='补充讲解后的澄清题干';
  const recordedGeneration=(await withUserDatabase(ids[0],c=>c.query('SELECT * FROM course_generations WHERE course_id=$1',[course.id]))).rows;
  await assert.rejects(reviseCourse(ids[1],course.id,originalVersion,revised,'来源核对后补充'),/找不到/);
  await reviseCourse(ids[0],course.id,originalVersion,revised,'来源核对后补充');
  const corrected=await getCourse(ids[0],course.id);
  assert.equal(corrected?.content_revision,1);assert.equal(corrected?.active_generation,calls[0]);assert.equal(corrected?.attempts,1);
  assert.deepEqual((await withUserDatabase(ids[0],c=>c.query('SELECT * FROM course_generations WHERE course_id=$1',[course.id]))).rows,recordedGeneration);
  assert.deepEqual(await getCourseMaterial(ids[0],course.id,originalVersion),fixtureMaterial);
  assert.equal(await getCourseMaterial(ids[1],course.id,originalVersion),null);
  const history=await withUserDatabase(ids[0],c=>c.query('SELECT revision FROM course_material_versions WHERE course_id=$1 ORDER BY revision',[course.id]));
  assert.deepEqual(history.rows.map(r=>r.revision),[0,1]);
  await assert.rejects(saveCourseAttempt(ids[0],course.id,randomUUID(),answers,originalVersion),/版本已更新/);
  assert.equal((await saveCourseAttempt(ids[0],course.id,attemptKey,{...answers,q1:'0'},originalVersion)).score,5);
  const newResult=await saveCourseAttempt(ids[0],course.id,randomUUID(),answers,`${originalVersion}:r1`);
  assert.equal(newResult.lesson_version,`${originalVersion}:r1`);
  const invalidRevision=structuredClone(revised);invalidRevision.lesson.questions[0].correctIndex=0;
  await assert.rejects(reviseCourse(ids[0],course.id,`${originalVersion}:r1`,invalidRevision,'不能静默改答案'),/选项或答案/);
  const changedPlan=structuredClone(revised);changedPlan.weeklyTopics[0]='不能在正文修订时改变已保存日程';
  await assert.rejects(reviseCourse(ids[0],course.id,`${originalVersion}:r1`,changedPlan,'课程日程另行审批'),/仅支持/);
  const changedSource=structuredClone(revised);changedSource.lesson.sections[0].sourceIds=['s2'];
  await assert.rejects(reviseCourse(ids[0],course.id,`${originalVersion}:r1`,changedSource,'不能把原文换挂另一来源'),/原章节引用/);
  await assert.rejects(reviseCourse(ids[0],course.id,originalVersion,revised,'重复旧版本修订'),/版本已更新/);
  await withUserDatabase(ids[0],c=>c.query('UPDATE learning_courses SET created_day=created_day-1 WHERE id=$1',[course.id]));
  await assert.rejects(createCourse(ids[0],randomUUID(),input),/时间/);
  const shared = await createCourse(ids[0],randomUUID(),{...input,dailyMinutes:35});
  assert.ok(shared.schedule.every(day=>day.learn+day.practice+day.review===5));
  let abortedId=''; const originalSend=boss.send.bind(boss);
  const sendFault=t.mock.method(boss,'send',async (...args:any[])=>{
    abortedId=args[1].generationId;
    await (originalSend as any)(...args); throw new Error('injected queue acknowledgment failure');
  });
  await assert.rejects(requestGeneration(ids[0],shared.id));
  sendFault.mock.restore();
  assert.equal((await boss.findJobs(courseQueue,{data:{generationId:abortedId}})).length,0);
  const failedNew=await withUserDatabase(ids[0],c=>c.query('SELECT id FROM course_generations WHERE course_id=$1',[shared.id]));
  assert.equal(failedNew.rowCount,0);
  let sentPlan:any;
  const httpFixture=t.mock.method(globalThis,'fetch',async (url:any,options:any)=>{
    if(String(url).includes('/pricing'))return new Response(fixturePricing(),{headers:{'content-type':'text/html'}});
    if (String(url).endsWith('/chat/completions')) {
      sentPlan=JSON.parse(JSON.parse(options.body).messages[1].content);
      return new Response(JSON.stringify({model:fixtureModel,usage:{prompt_tokens:100,completion_tokens:10},choices:[{finish_reason:'stop',message:{content:JSON.stringify({sourceInsufficient:true,reason:'模拟资料不足'})}}]}));
    }
    return new Response('太阳是恒星，内部核聚变释放能量。'.repeat(30),{headers:{'content-type':'text/plain'}});
  });
  const sharedGeneration=await requestGeneration(ids[0],shared.id);
  await runGeneration({ownerId:ids[0],generationId:sharedGeneration});
  httpFixture.mock.restore();
  assert.deepEqual(sentPlan.firstDay,{learn:2,practice:1,review:2,total:5});
  const free=(await withUserDatabase(ids[0],c=>c.query('SELECT * FROM course_generations WHERE id=$1',[sharedGeneration]))).rows[0];
  assert.equal(free.accounted_fen,0);assert.equal(free.billing_status,'free');assert.equal(free.pricing_receipt.model,fixtureModel);
  const former=await requestGeneration(ids[0],shared.id);
  await withUserDatabase(ids[0],c=>c.query("UPDATE course_generations SET model_provider='aliyun',model_name='qwen3.8-flash' WHERE id=$1",[former]));
  let contacted=false;const noCall=t.mock.method(globalThis,'fetch',async()=>{contacted=true;throw new Error('Must never call a different provider');});
  await runGeneration({ownerId:ids[0],generationId:former});noCall.mock.restore();assert.equal(contacted,false);
  assert.match((await getCourse(ids[0],shared.id))!.error,/排队任务不同/);
  for(const usage of [undefined,{inputTokens:100,outputTokens:10}]){
    const unproven=await requestGeneration(ids[0],shared.id);await beginGeneration(ids[0],unproven);
    await finishGeneration(ids[0],unproven,{material:fixtureMaterial,sources:receipts,usage,provenance:'real'});
    const prevented=(await withUserDatabase(ids[0],c=>c.query('SELECT status,billing_status,accounted_fen FROM course_generations WHERE id=$1',[unproven]))).rows[0];
    assert.equal(prevented.status,'failed');assert.equal(prevented.billing_status,'unknown');assert.equal(prevented.accounted_fen,10);
  }

  const second = await createCourse(ids[1],randomUUID(),input);
  const generation = await requestGeneration(ids[1],second.id);
  delete process.env.SILICONFLOW_API_KEY;
  await runGeneration({ownerId:ids[1],generationId:generation});
  assert.equal((await getCourse(ids[1],second.id))?.status,'failed');
  const refunded = await withUserDatabase(ids[1],c => c.query('SELECT accounted_fen FROM course_generations WHERE id=$1',[generation]));
  assert.equal(refunded.rows[0].accounted_fen,0);
  process.env.SILICONFLOW_API_KEY = 'local-integration-not-a-real-key';
  process.env.MODEL_MONTHLY_BUDGET_FEN = '0';
  await assert.rejects(requestGeneration(ids[1],second.id),/预算/);
  delete process.env.MODEL_MONTHLY_BUDGET_FEN;
  const recovered = await requestGeneration(ids[1],second.id);
  assert.notEqual(recovered,generation);
  await beginGeneration(ids[1],recovered);
  await withUserDatabase(ids[1],c => c.query("UPDATE course_generations SET updated_at=now()-interval '10 minutes' WHERE id=$1",[recovered]));
  const replacement = await requestGeneration(ids[1],second.id);
  assert.notEqual(replacement,recovered);
  await finishGeneration(ids[1],recovered,{material:fixtureMaterial,sources:receipts,usage:{inputTokens:0,outputTokens:0},provenance:'simulation'});
  assert.equal((await getCourse(ids[1],second.id))?.status,'queued');
  await beginGeneration(ids[1],replacement);
  await withUserDatabase(ids[1],c=>c.query("UPDATE course_generations SET updated_at=now()-interval '10 minutes' WHERE id=$1",[replacement]));
  process.env.MODEL_MONTHLY_BUDGET_FEN='0';
  await assert.rejects(requestGeneration(ids[1],second.id),/预算/);
  delete process.env.MODEL_MONTHLY_BUDGET_FEN;
  assert.equal((await getCourse(ids[1],second.id))?.status,'failed');
  const fourth=await requestGeneration(ids[1],second.id); await beginGeneration(ids[1],fourth);
  await finishGeneration(ids[1],fourth,{error:'模拟失败，无外部调用'});
  const fifth=await requestGeneration(ids[1],second.id); await beginGeneration(ids[1],fifth);
  await withUserDatabase(ids[1],c=>c.query("UPDATE course_generations SET updated_at=now()-interval '10 minutes' WHERE id=$1",[fifth]));
  await assert.rejects(requestGeneration(ids[1],second.id),/上限/);
  assert.equal((await getCourse(ids[1],second.id))?.status,'failed');
  const terminal=await withUserDatabase(ids[1],c=>c.query('SELECT status,billing_status FROM course_generations WHERE id=$1',[fifth]));
  assert.equal(terminal.rows[0].status,'failed');assert.equal(terminal.rows[0].billing_status,'unknown');
  // Preserve the former provider's estimates when processing an old recorded generation; never call it.
  await withUserDatabase(ids[1],async c=>{await c.query("UPDATE course_generations SET model_provider='aliyun',model_name='qwen3.8-flash',status='running' WHERE id=$1",[fourth]);await c.query('UPDATE learning_courses SET active_generation=$2 WHERE id=$1',[second.id,fourth]);});
  await finishGeneration(ids[1],fourth,{error:'legacy billing fixture only',usage:{inputTokens:10000,outputTokens:1000}});
  const legacy=(await withUserDatabase(ids[1],c=>c.query('SELECT * FROM course_generations WHERE id=$1',[fourth]))).rows[0];
  assert.equal(legacy.accounted_fen,2);assert.equal(legacy.billing_status,'estimated');assert.equal(legacy.model_provider,'aliyun');
});
