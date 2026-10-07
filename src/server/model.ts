import {createHash} from 'node:crypto';
import {validateUsage} from '../features/course/domain.ts';
import type { Usage } from '../features/course/domain.ts';
export const freeModel='XingChenAGI/Xing4.0-29B';
export const priceURL='https://www.siliconflow.cn/pricing';
export type FreePrice={model:string;inputPrice:'0';outputPrice:'0';source:string;checkedAt:string;digest:string};
export function validFreePrice(receipt:FreePrice|undefined,model:string){
  const age=receipt?Date.now()-new Date(receipt.checkedAt).getTime():NaN;
  return !!receipt&&model===freeModel&&receipt.model===model&&receipt.source===priceURL&&receipt.inputPrice==='0'&&receipt.outputPrice==='0'&&/^[0-9a-f]{64}$/.test(receipt.digest)&&age>=-60000&&age<=180000;
}
export function modelConfig() {
  const key=process.env.SILICONFLOW_API_KEY?.trim();
  const base=(process.env.SILICONFLOW_BASE_URL?.trim()||'https://api.siliconflow.cn/v1').replace(/\/$/,'');
  const model=process.env.SILICONFLOW_MODEL?.trim()||freeModel;
  if(!key)throw new Error('硅基流动尚未配置。请在本机 .env.local 填写 SILICONFLOW_API_KEY，课程草案已保留。');
  if(base!=='https://api.siliconflow.cn/v1')throw new Error('硅基流动仅支持官方 HTTPS API 地址 https://api.siliconflow.cn/v1。');
  if(model!==freeModel)throw new Error(`硅基流动免费模型仅允许 ${freeModel}，不会自动切换到付费模型。`);
  return {key,url:`${base}/chat/completions`,provider:'siliconflow',model};
}
export function parseFreePrice(html:string):{inputPrice:'0';outputPrice:'0'}{
  // ponytail: parse JSON literals from the official page, never execute its scripts. Fail closed if its format changes.
  const models:any[]=[];
  function visit(value:any){
    if(!value||typeof value!=='object')return;
    if(value.modelName===freeModel&&Array.isArray(value.pricing)){models.push(value);return;}
    Object.values(value).forEach(visit);
  }
  for(const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)){
    const text=JSON.parse(m[1]);
    for(const line of text.split('\n')){
      const entry=line.match(/^[0-9a-f]+:(\{.*\}|\[.*\])$/);if(!entry)continue;
      let value;try{value=JSON.parse(entry[1]);}catch{continue;}visit(value);
    }
  }
  const model=models[0],rates=model?.pricing;
  if(models.length!==1||model.status!=='normal'||model.type!=='text'||model.subType!=='chat'||model.jsonModeSupport!==true||!Array.isArray(rates)||rates.length!==2)throw new Error('硅基流动免费价格或JSON能力无法确认，未调用模型。');
  const prices=rates;
  if(new Set(prices.map(p=>p?.specification)).size!==2||!prices.every(p=>['prompt','completion'].includes(p?.specification)&&(p.price===0||/^0(?:\.0+)?$/.test(p.price))))throw new Error('硅基流动免费价格不再为零或无法确认，未调用模型。');
  return {inputPrice:'0',outputPrice:'0'};
}
export async function verifyFreePrice(signal:AbortSignal):Promise<FreePrice>{
  try{
    const response=await fetch(priceURL,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),redirect:'error'});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();throw new Error('pricing unavailable');}
    const html=await readBounded(response,1500000),prices=parseFreePrice(html);
    return {model:freeModel,...prices,source:priceURL,checkedAt:new Date().toISOString(),digest:createHash('sha256').update(html).digest('hex')};
  }catch(e){throw new Error(e instanceof Error&&e.message.startsWith('硅基流动免费价格')?e.message:'硅基流动免费价格核验失败，未调用模型，请稍后重试。');}
}
export async function readBounded(response:Response, limit:number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('服务没有返回正文。');
  const chunks:Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('返回内容超过大小限制。'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}
export async function callCourseModel(messages:{role:string;content:string}[], signal:AbortSignal) {
  const config = modelConfig();
  if (Buffer.byteLength(JSON.stringify(messages),'utf8') > 50000) throw new Error('课程资料过长，请减少范围。');
  let sent=false,unexpectedModel=false,usage:Usage|undefined,pricing:FreePrice|undefined;
  try {
    pricing=await verifyFreePrice(signal);
    sent = true;
    const response = await fetch(config.url, {
      method:'POST', headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:config.model,messages,response_format:{type:'json_object'},max_tokens:6000,temperature:.3}),
      signal:AbortSignal.any([signal,AbortSignal.timeout(60000)]), redirect:'error',
    });
    if (!response.ok) {
      sent = response.status >= 500;
      await response.body?.cancel();
      if(response.status===402)throw new Error('硅基流动账户余额或欠费状态阻止调用（HTTP 402），请在控制台核对后再手动重试；课程草案已保留。');
      throw new Error(response.status === 429 ? '硅基流动请求限流，请稍后手动重试。' : `硅基流动返回错误（HTTP ${response.status}），请检查密钥、权限或稍后重试。`);
    }
    const result = JSON.parse(await readBounded(response,512000));
    const candidate:Usage={inputTokens:result.usage?.prompt_tokens,outputTokens:result.usage?.completion_tokens};
    const reasoning=result.usage?.completion_tokens_details?.reasoning_tokens;
    if(reasoning!==undefined)candidate.reasoningTokens=reasoning;
    validateUsage(candidate);usage=candidate;
    if(result.model!==config.model){unexpectedModel=true;throw new Error('硅基流动返回了不同模型，课程未发布，费用需要核对。');}
    if (result.choices?.[0]?.finish_reason !== 'stop' || typeof result.choices[0]?.message?.content !== 'string') throw new Error('模型没有返回完整课程，请缩小范围后重试。');
    return {raw:JSON.parse(result.choices[0].message.content),usage,pricing};
  } catch (error) {
    const message = error instanceof Error && !['SyntaxError','AbortError','TimeoutError','TypeError'].includes(error.name) ? error.message : '模型调用超时、连接中断或内容格式无效，请稍后重试。';
    throw Object.assign(new Error(message),{usage,pricing,unknownCharge:unexpectedModel||(sent&&!usage)});
  }
}
