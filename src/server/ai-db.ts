import {Pool} from 'pg';
import type {PoolClient} from 'pg';
const state=globalThis as typeof globalThis&{assessmentWorkerPool?:Pool};
function workerPool(){
  if(!process.env.ASSESSMENT_WORKER_DATABASE_URL)throw new Error('考核AI后台数据库尚未配置，未调用模型。');
  return state.assessmentWorkerPool??=new Pool({connectionString:process.env.ASSESSMENT_WORKER_DATABASE_URL,max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:1000});
}
export async function withAIDatabase<T>(user:string,operation:(c:PoolClient)=>Promise<T>){
  const c=await workerPool().connect();
  try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true)",[user]);const result=await operation(c);await c.query('COMMIT');return result;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function closeAIDatabase(){await state.assessmentWorkerPool?.end();delete state.assessmentWorkerPool;}
