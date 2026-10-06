import { auth } from '@/server/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { boundedAuthRequest } from '@/features/auth/input';
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  const input = await boundedAuthRequest(request);
  return input instanceof Response ? input : handlers.POST(input);
}
