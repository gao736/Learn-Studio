import test from 'node:test';
import assert from 'node:assert/strict';
import {modelConfig,callCourseModel,verifyFreePrice,parseFreePrice,freeModel} from '../src/server/model.ts';
import {fixtureModel as model,fixturePricing as page} from './fixtures/siliconflow.ts';
test('SiliconFlow configuration permits only the official endpoint and the approved free text model',()=>{
  process.env.SILICONFLOW_API_KEY='test-only-not-a-real-key';process.env.SILICONFLOW_BASE_URL='https://api.siliconflow.cn/v1';process.env.SILICONFLOW_MODEL=model;
  assert.equal(modelConfig().model,freeModel);assert.equal(modelConfig().url,'https://api.siliconflow.cn/v1/chat/completions');
  for(const host of ['http://api.siliconflow.cn/v1','https://127.0.0.1/v1','https://api.siliconflow.cn.evil.test/v1','https://user:pass@api.siliconflow.cn/v1','https://api.siliconflow.cn/v1?foo=1']){process.env.SILICONFLOW_BASE_URL=host;assert.throws(modelConfig,/硅基流动/);}
  process.env.SILICONFLOW_BASE_URL='https://api.siliconflow.cn/v1';
  for(const paid of ['Pro/XingChenAGI/Xing4.0-29B','deepseek-ai/DeepSeek-V4-Flash','Qwen/Qwen3.8-27B']){process.env.SILICONFLOW_MODEL=paid;assert.throws(modelConfig,/免费模型/);}
  process.env.SILICONFLOW_MODEL=model;delete process.env.SILICONFLOW_API_KEY;assert.throws(modelConfig,/尚未配置/);
});
test('Free price parser rejects nonzero, missing, ambiguous or unsupported pricing',()=>{
  assert.deepEqual(parseFreePrice(page()),{inputPrice:'0',outputPrice:'0'});
  for(const html of [page('0','1'),page('1','0'),page('0',''),page().replace('completion','cached'),page().replace('normal','offline'),page().replace('jsonModeSupport', 'oldMode'),page()+page('1','1')])assert.throws(()=>parseFreePrice(html),/免费价格/);
});
test('Only verified zero pricing permits a model request, with JSON output and no paid fallback',async t=>{
  process.env.SILICONFLOW_API_KEY='test-only-not-a-real-key';process.env.SILICONFLOW_BASE_URL='https://api.siliconflow.cn/v1';process.env.SILICONFLOW_MODEL=model;
  let calls=0;const http=t.mock.method(globalThis,'fetch',async (url:any,options:any)=>{
    if(String(url).includes('/pricing')){assert.ok(!options?.headers?.Authorization);return new Response(page(),{headers:{'content-type':'text/html'}});}
    calls++;assert.equal(String(url),'https://api.siliconflow.cn/v1/chat/completions');const body=JSON.parse(options.body);assert.equal(body.model,model);assert.deepEqual(body.response_format,{type:'json_object'});assert.ok(!('enable_thinking' in body));
    return new Response(JSON.stringify({model,usage:{prompt_tokens:100,completion_tokens:10},choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]}));
  });
  const result=await callCourseModel([{role:'user',content:'请生成JSON'}],AbortSignal.timeout(3000));assert.deepEqual(result.raw,{ok:true});assert.equal(result.pricing.model,model);assert.equal(result.pricing.inputPrice,'0');assert.equal(calls,1);
  http.mock.mockImplementation(async(url:any)=>{if(String(url).includes('/pricing'))return new Response(page(),{headers:{'content-type':'text/html'}});calls++;return new Response(JSON.stringify({model,usage:{prompt_tokens:100,completion_tokens:7000,completion_tokens_details:{reasoning_tokens:1000}},choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]}));});
  assert.deepEqual((await callCourseModel([{role:'user',content:'JSON'}],AbortSignal.timeout(3000))).usage,{inputTokens:100,outputTokens:7000,reasoningTokens:1000});
  http.mock.mockImplementation(async()=>new Response(page('0','1'),{headers:{'content-type':'text/html'}}));
  await assert.rejects(callCourseModel([{role:'user',content:'JSON'}],AbortSignal.timeout(3000)),/免费价格/);assert.equal(calls,2);
  http.mock.mockImplementation(async()=>new Response('{}',{status:503}));await assert.rejects(verifyFreePrice(AbortSignal.timeout(3000)),/免费价格/);
});
