import test from 'node:test';
import assert from 'node:assert/strict';
import { callCourseModel,modelConfig } from '../src/server/model.ts';
import { readSource } from '../src/features/course/generate.ts';
test('gateway billing distinguishes rejected calls from uncertain and billed malformed responses', async t => {
  process.env.DASHSCOPE_API_KEY='local-boundary-fixture-not-a-real-key';
  process.env.DASHSCOPE_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1';
  const messages=[{role:'user',content:'JSON课题'}], signal=AbortSignal.timeout(1000);
  const replacement=t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:429}));
  await assert.rejects(callCourseModel(messages,signal),error=>!!error && (error as any).unknownCharge===false);
  replacement.mock.mockImplementation(async()=>new Response('{}',{status:500}));
  await assert.rejects(callCourseModel(messages,signal),error=>(error as any).unknownCharge===true);
  replacement.mock.mockImplementation(async()=>new Response(JSON.stringify({usage:{prompt_tokens:10000,completion_tokens:1000},choices:[{finish_reason:'stop',message:{content:'invalid JSON'}}]})));
  await assert.rejects(callCourseModel(messages,signal),error=>{assert.deepEqual((error as any).usage,{inputTokens:10000,outputTokens:1000});return true;});
  process.env.DASHSCOPE_BASE_URL='https://untrusted.example/compatible-mode/v1';
  assert.throws(modelConfig,/北京地域/);
});
test('source reader rejects untrusted redirects and strips executable HTML before giving text to the model', async t => {
  const replacement=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}}));
  await assert.rejects(readSource('https://science.nasa.gov/universe/stars/',AbortSignal.timeout(1000)));
  replacement.mock.mockImplementation(async()=>new Response(`<script>stealSecret()</script><style>hidden</style><article>${'太阳是恒星，内部核聚变释放能量。'.repeat(30)}</article>`,{headers:{'content-type':'text/html'}}));
  const source=await readSource('https://science.nasa.gov/universe/stars/',AbortSignal.timeout(1000));
  assert.ok(source.text.includes('太阳是恒星'));assert.ok(!source.text.includes('stealSecret'));assert.equal(source.digest.length,64);
});
