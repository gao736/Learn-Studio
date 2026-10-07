import {headers} from 'next/headers';
import {auth} from '@/server/auth';
import {getReview} from '@/features/review/repository';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await auth.api.getSession({headers:await headers()});
  if(!session)return Response.json({error:'请先登录。'},{status:401,headers:{'Cache-Control':'private, no-store'}});
  const {id}=await params,review=await getReview(session.user.id,id);
  return Response.json(review??{error:'找不到这次复习。'},{status:review?200:404,headers:{'Cache-Control':'private, no-store'}});
}
