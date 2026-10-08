import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
const path=new URL('../.runtime/local-db.json',import.meta.url),local=JSON.parse(await readFile(path,'utf8'));
const admin=new Pool({host:'127.0.0.1',port:54329,database:'learning_platform',user:'learning_admin',password:local.adminPassword});
try{
  const role=(await admin.query("SELECT rolsuper,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname='learning_ai_worker'")).rows[0];
  if(role&&(!local.aiPassword||role.rolsuper||role.rolcreaterole||role.rolcreatedb))throw new Error('现有AI后台角色不符合本项目配置，未修改。');
  if(!role){local.aiPassword=randomBytes(32).toString('hex');const command=(await admin.query("SELECT format('CREATE ROLE learning_ai_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L',$1::text)",[local.aiPassword])).rows[0].format;await admin.query(command);await writeFile(path,JSON.stringify(local,null,2));}
  if((await admin.query("SELECT pg_has_role('learning_app','learning_ai_worker','MEMBER') AS member")).rows[0].member)throw new Error('应用角色不应拥有AI后台角色权限，停止配置。');
  await admin.query('GRANT USAGE ON SCHEMA public TO learning_ai_worker');
  await admin.query('GRANT SELECT,UPDATE ON assessment_ai_checks,assessment_packs TO learning_ai_worker');
  await admin.query('GRANT SELECT ON learning_courses,assessment_reviewers TO learning_ai_worker');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON model_budgets TO learning_ai_worker');
  await admin.query(await readFile(new URL('../migrations/007-assessment-ai.sql',import.meta.url),'utf8'));
  const envPath=new URL('../.env.local',import.meta.url),env=await readFile(envPath,'utf8');
  const line=`ASSESSMENT_WORKER_DATABASE_URL=postgresql://learning_ai_worker:${local.aiPassword}@127.0.0.1:54329/learning_platform`;
  await writeFile(envPath,env.match(/^ASSESSMENT_WORKER_DATABASE_URL=.*$/m)?env.replace(/^ASSESSMENT_WORKER_DATABASE_URL=.*$/m,line):`${env.trimEnd()}\n${line}\n`);
  console.log('AI后台独立数据库角色已配置，未输出凭据；普通账户不能伪造AI完成记录。');
}finally{await admin.end();}
