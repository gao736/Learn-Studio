import { currentUser } from '@/server/session';
import { getAttempt } from '@/features/lesson/repository';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ code: 'UNAUTHENTICATED', message: '请先验证邮箱并登录。' }, { status: 401 });
  const { id } = await params;
  try {
    const result = await getAttempt(user.id, id);
    if (!result) return Response.json({ code: 'NOT_FOUND', message: '没有找到这条记录。' }, { status: 404 });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ code: 'TEMPORARILY_UNAVAILABLE', message: '暂时无法读取记录，请稍后重试。' }, { status: 503 }); }
}
