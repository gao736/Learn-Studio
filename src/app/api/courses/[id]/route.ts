import { currentUser } from '@/server/session';
import { getCourse } from '@/features/course/repository';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const user = await currentUser(); if (!user) return Response.json({error:'请先登录。'},{status:401});
  const {id} = await params;
  try {
    const course = await getCourse(user.id,id); if (!course) return Response.json({error:'找不到课程。'},{status:404});
    return Response.json({id:course.id,status:course.status,error:course.error,provenance:course.provenance,recoverable:!!course.generation_updated_at && Date.now()-new Date(course.generation_updated_at).getTime() >= 180000},{headers:{'Cache-Control':'private, no-store'}});
  } catch { return Response.json({error:'暂时无法读取课程，请重试。'},{status:503}); }
}
