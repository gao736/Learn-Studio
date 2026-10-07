import {currentUser} from '@/server/session';
import {getAssessment} from '@/features/assessment/repository';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return Response.json({error:'请先登录。'},{status:401});
  const {id}=await params,session=await getAssessment(user.id,id);
  return Response.json(session||{error:'找不到这个考核。'},{status:session?200:404,headers:{'Cache-Control':'private, no-store'}});
}
