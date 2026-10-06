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
  if (new URL(request.url).pathname.endsWith('/sign-up/email')) {
    let data;
    try { data = JSON.parse(body); }
    catch { return Response.json({ code: 'INVALID_INPUT', message: '输入格式无效。' }, { status: 400 }); }
    if (typeof data?.name !== 'string' || !data.name.trim() || data.name.length > 80) {
      return Response.json({ code: 'INVALID_INPUT', message: '称呼需要 1—80 个字符。' }, { status: 400 });
    }
  }
  // Next's Request and Node's Request can come from different runtimes.
  return new Request(request.url, { method: request.method, headers: request.headers, body: body || undefined });
}
