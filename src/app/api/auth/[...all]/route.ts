import { auth, localMail } from '@/server/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { boundedAuthRequest } from '@/features/auth/input';
const handlers = toNextJsHandler(auth);
export async function GET(request: Request) {
  if (new URL(request.url).pathname === '/api/auth/mail-mode') {
    return Response.json({ localMail }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return handlers.GET(request);
}
export async function POST(request: Request) {
  const input = await boundedAuthRequest(request);
  return input instanceof Response ? input : handlers.POST(input);
}
