import {isTestEmail,localEmailMessage} from './domain.ts';
export async function boundedAuthRequest(request: Request): Promise<Request | Response> {
  const reader = request.body?.getReader();
  if (!reader) return request;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return Response.json({ code: 'PAYLOAD_TOO_LARGE', message: '请求内容过大。' }, { status: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = Buffer.concat(chunks).toString('utf8');
  const route=new URL(request.url).pathname;
  const signup=route.endsWith('/sign-up/email');
  const localRecipient=process.env.LOCAL_MAILBOX==='true'&&['/sign-up/email','/send-verification-email','/request-password-reset'].some(path=>route.endsWith(path));
  if (signup||localRecipient) {
    let data;
    try { data = JSON.parse(body); }
    catch { return Response.json({ code: 'INVALID_INPUT', message: '输入格式无效。' }, { status: 400 }); }
    if (signup&&(typeof data?.name !== 'string' || !data.name.trim() || data.name.length > 80)) {
      return Response.json({ code: 'INVALID_INPUT', message: '称呼需要 1—80 个字符。' }, { status: 400 });
    }
    if(localRecipient&&!isTestEmail(data?.email))return Response.json({code:'LOCAL_TEST_EMAIL_REQUIRED',message:localEmailMessage},{status:400});
  }
  // Next's Request and Node's Request can come from different runtimes.
  return new Request(request.url, { method: request.method, headers: request.headers, body: body || undefined });
}
