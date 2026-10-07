import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtureMaterial } from './fixtures/course.ts';
process.loadEnvFile('.env.local');
process.env.COURSE_QUEUE = `test-course-${randomUUID()}`;
process.env.DASHSCOPE_API_KEY = 'local-integration-not-a-real-key';
process.env.DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const { pool, withUserDatabase } = await import('../src/server/db.ts');
const { getBoss, courseQueue } = await import('../src/server/queue.ts');
const { createCourse, getCourse, requestGeneration, beginGeneration, finishGeneration, saveCourseAttempt } = await import('../src/features/course/repository.ts');
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
  assert.ok(await beginGeneration(ids[0],calls[0]));
  const receipts = [{id:'s1',url:'https://science.nasa.gov/universe/stars/',title:'模拟来源',fetchedAt:new Date().toISOString(),digest:'simulation'}];
  await finishGeneration(ids[0],calls[0],{ material:fixtureMaterial, sources:receipts, usage:{inputTokens:0,outputTokens:0}, provenance:'simulation' });
  await finishGeneration(ids[0],calls[0],{error:'late duplicate',unknownCharge:true});
  assert.equal((await getCourse(ids[0],course.id))?.status,'ready');
  const answers = {q1:'1',q2:'0',q3:'2',q4:'1',q5:'0'};
  const attemptKey = randomUUID();
  const result = await saveCourseAttempt(ids[0],course.id,attemptKey,answers);
  assert.equal(result.score,5);
  assert.equal((await saveCourseAttempt(ids[0],course.id,attemptKey,{...answers,q1:'0'})).id,result.id);
  await assert.rejects(saveCourseAttempt(ids[1],course.id,randomUUID(),answers));
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
    if (String(url).endsWith('/chat/completions')) {
      sentPlan=JSON.parse(JSON.parse(options.body).messages[1].content);
      return new Response(JSON.stringify({usage:{prompt_tokens:100,completion_tokens:10},choices:[{finish_reason:'stop',message:{content:JSON.stringify({sourceInsufficient:true,reason:'模拟资料不足'})}}]}));
    }
    return new Response('太阳是恒星，内部核聚变释放能量。'.repeat(30),{headers:{'content-type':'text/plain'}});
  });
  const sharedGeneration=await requestGeneration(ids[0],shared.id);
  await runGeneration({ownerId:ids[0],generationId:sharedGeneration});
  httpFixture.mock.restore();
  assert.deepEqual(sentPlan.firstDay,{learn:2,practice:1,review:2,total:5});

  const second = await createCourse(ids[1],randomUUID(),input);
  const generation = await requestGeneration(ids[1],second.id);
  delete process.env.DASHSCOPE_API_KEY;
  await runGeneration({ownerId:ids[1],generationId:generation});
  assert.equal((await getCourse(ids[1],second.id))?.status,'failed');
  const refunded = await withUserDatabase(ids[1],c => c.query('SELECT accounted_fen FROM course_generations WHERE id=$1',[generation]));
  assert.equal(refunded.rows[0].accounted_fen,0);
  process.env.DASHSCOPE_API_KEY = 'local-integration-not-a-real-key';
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
});
