import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
const [mode,email]=process.argv.slice(2);
if(!['grant','revoke'].includes(mode)||!email||email.length>320)throw new Error('用法：node scripts/reviewer.ts grant|revoke 已验证的本机邮箱');
// Local operator only. No administrative credentials or grants are exposed to web clients.
const local=JSON.parse(await readFile(new URL('../.runtime/local-db.json',import.meta.url),'utf8'));
const admin=new Pool({host:'127.0.0.1',port:54329,database:'learning_platform',user:'learning_admin',password:local.adminPassword});
try{
  const user=(await admin.query('SELECT id FROM "user" WHERE email=$1 AND "emailVerified"=true',[email])).rows[0];
  if(!user)throw new Error('账户尚未注册并验证邮箱，未修改权限。');
  if(mode==='grant')await admin.query('INSERT INTO assessment_reviewers(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user.id]);
  else await admin.query('DELETE FROM assessment_reviewers WHERE user_id=$1',[user.id]);
  console.log(mode==='grant'?'指定本机账户的复核权限已授予；不能复核自身作答。':'指定本机账户的复核权限已撤销。');
}finally{await admin.end();}
