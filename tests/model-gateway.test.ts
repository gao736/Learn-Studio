import test from 'node:test';
import assert from 'node:assert/strict';
import { callCourseModel,modelConfig } from '../src/server/model.ts';
import { readSource } from '../src/features/course/generate.ts';
import {fixtureModel,fixturePricing} from './fixtures/siliconflow.ts';
test('gateway billing distinguishes rejected calls from uncertain and billed malformed responses', async t => {
  process.env.SILICONFLOW_API_KEY='local-boundary-fixture-not-a-real-key';
  process.env.SILICONFLOW_BASE_URL='https://api.siliconflow.cn/v1';process.env.SILICONFLOW_MODEL=fixtureModel;
  const messages=[{role:'user',content:'JSON课题'}], signal=AbortSignal.timeout(1000);
  const price=(url:any)=>String(url).includes('/pricing');
  const replacement=t.mock.method(globalThis,'fetch',async(url:any)=>price(url)?new Response(fixturePricing(),{headers:{'content-type':'text/html'}}):new Response('{}',{status:429}));
  await assert.rejects(callCourseModel(messages,signal),error=>!!error && (error as any).unknownCharge===false);
  replacement.mock.mockImplementation(async(url:any)=>price(url)?new Response(fixturePricing(),{headers:{'content-type':'text/html'}}):new Response('{}',{status:500}));
  await assert.rejects(callCourseModel(messages,signal),error=>(error as any).unknownCharge===true);
  replacement.mock.mockImplementation(async(url:any)=>price(url)?new Response(fixturePricing(),{headers:{'content-type':'text/html'}}):new Response(JSON.stringify({model:fixtureModel,usage:{prompt_tokens:10000,completion_tokens:1000},choices:[{finish_reason:'stop',message:{content:'invalid JSON'}}]})));
  await assert.rejects(callCourseModel(messages,signal),error=>{assert.deepEqual((error as any).usage,{inputTokens:10000,outputTokens:1000});return true;});
  replacement.mock.mockImplementation(async(url:any)=>price(url)?new Response(fixturePricing(),{headers:{'content-type':'text/html'}}):new Response(JSON.stringify({model:'paid-alias',usage:{prompt_tokens:100,completion_tokens:10},choices:[]})));
  await assert.rejects(callCourseModel(messages,signal),error=>(error as any).unknownCharge===true);
  process.env.SILICONFLOW_BASE_URL='https://untrusted.example/v1';
  assert.throws(modelConfig,/官方 HTTPS/);
});
test('source reader rejects untrusted redirects and strips executable HTML before giving text to the model', async t => {
  const replacement=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}}));
  await assert.rejects(readSource('https://science.nasa.gov/universe/stars/',AbortSignal.timeout(1000)));
  replacement.mock.mockImplementation(async()=>new Response(`<script>stealSecret()</script><style>hidden</style><article>${'太阳是恒星，内部核聚变释放能量。'.repeat(30)}</article>`,{headers:{'content-type':'text/html'}}));
  const source=await readSource('https://science.nasa.gov/universe/stars/',AbortSignal.timeout(1000));
  assert.ok(source.text.includes('太阳是恒星'));assert.ok(!source.text.includes('stealSecret'));assert.equal(source.digest.length,64);
});
test('source reader keeps lesson text ahead of long navigation in main or article pages', async t => {
  const replacement=t.mock.method(globalThis,'fetch');
  const body='Stars are giant balls of hot gas. Hydrogen fusion powers their light. '.repeat(8);
  for (const tag of ['main','article']) {
    const html=`<script>const fake="<main>untrusted script</main>";</script><nav>${'irrelevant menu '.repeat(600)}</nav><${tag}><aside>${'irrelevant menu '.repeat(600)}</aside><h1>Star basics</h1><p>${body}</p></${tag}><footer>irrelevant footer</footer>`;
    replacement.mock.mockImplementation(async()=>new Response(html,{headers:{'content-type':'text/html'}}));
    const source=await readSource('https://science.nasa.gov/universe/stars/',AbortSignal.timeout(1000));
    assert.ok(source.text.startsWith('Star basics Stars are giant balls of hot gas.'));
    assert.ok(!source.text.includes('irrelevant') && !source.text.includes('untrusted script'));
    assert.ok(source.text.length <= 6000);
  }
});
