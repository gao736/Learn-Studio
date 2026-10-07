import { estimateFen } from '../features/course/domain.ts';
import type { Usage } from '../features/course/domain.ts';
export function modelConfig() {
  const key = process.env.DASHSCOPE_API_KEY?.trim();
  const base = process.env.DASHSCOPE_BASE_URL?.trim();
  if (!key || !base) throw new Error('百炼尚未配置。请在本机 .env.local 配置 API 密钥和北京地域 API Host，课程草案已保留。');
  if (!/^https:\/\/(dashscope\.aliyuncs\.com|[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com)\/compatible-mode\/v1\/?$/i.test(base)) throw new Error('仅支持已核对计费的百炼北京地域 HTTPS 地址。');
  return { key, url:`${base.replace(/\/$/,'')}/chat/completions` };
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
  let sent = false, usage:Usage | undefined;
  try {
    sent = true;
    const response = await fetch(config.url, {
      method:'POST', headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'qwen3.8-flash',messages,response_format:{type:'json_object'},enable_thinking:false,max_tokens:6000,temperature:.3}),
      signal:AbortSignal.any([signal,AbortSignal.timeout(60000)]), redirect:'error',
    });
    if (!response.ok) {
      sent = response.status >= 500;
      await response.body?.cancel();
      throw new Error(response.status === 429 ? '百炼请求限流，请稍后手动重试。' : `百炼返回错误（HTTP ${response.status}），请检查配置或稍后重试。`);
    }
    const result = JSON.parse(await readBounded(response,512000));
    const candidate = {inputTokens:result.usage?.prompt_tokens,outputTokens:result.usage?.completion_tokens};
    estimateFen(candidate); usage = candidate;
    if (result.choices?.[0]?.finish_reason !== 'stop' || typeof result.choices[0]?.message?.content !== 'string') throw new Error('模型没有返回完整课程，请缩小范围后重试。');
    return { raw:JSON.parse(result.choices[0].message.content), usage };
  } catch (error) {
    const message = error instanceof Error && !['SyntaxError','AbortError','TimeoutError','TypeError'].includes(error.name) ? error.message : '模型调用超时、连接中断或内容格式无效，请稍后重试。';
    throw Object.assign(new Error(message), {usage,unknownCharge:sent && !usage});
  }
}
