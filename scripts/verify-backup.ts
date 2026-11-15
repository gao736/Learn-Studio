import {Pool} from 'pg';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),root=fileURLToPath(new URL('..',import.meta.url));
const tables=['user','learning_courses','course_generations','course_material_versions','lesson_attempts','assessment_packs','assessment_sessions','assessment_reviews','assessment_ai_checks','review_cards','review_attempts','study_plans','study_plan_versions','weekly_sessions','model_budgets','assessment_reviewers','account','session','verification','rateLimit'];
const protectedTables=['learning_courses','lesson_attempts','assessment_packs','assessment_sessions','review_cards','review_attempts','study_plans','study_plan_versions','weekly_sessions'];
async function fingerprint(db:Pool){const rows=[];for(const table of tables){const values=(await db.query('SELECT to_jsonb(t) AS row FROM "'+table+'" t ORDER BY to_jsonb(t)::text')).rows;rows.push({table,count:values.length,digest:createHash('sha256').update(JSON.stringify(values)).digest('hex')});}return rows;}
let source:Pool|undefined,admin:Pool|undefined,restored:Pool|undefined,application:Pool|undefined,scratch='',transaction=false,created=false;
try{
 const appURL=new URL(process.env.DATABASE_URL||'');
 if(appURL.hostname!=='127.0.0.1'||appURL.port!=='54329'||appURL.pathname!=='/learning_platform'||decodeURIComponent(appURL.username)!=='learning_app')throw new Error('恢复演练只允许现有本机learning_platform；不接受目标数据库参数。');
 if(!process.env.PG_BIN)throw new Error('请将PG_BIN设为现有PostgreSQL工具目录。');
 const config=JSON.parse(await readFile(join(root,'.runtime/local-db.json'),'utf8'));
 const adminURL=new URL(appURL);adminURL.username='learning_admin';adminURL.password=config.adminPassword;
 source=new Pool({connectionString:adminURL.href,max:1});const postgresURL=new URL(adminURL);postgresURL.pathname='/postgres';admin=new Pool({connectionString:postgresURL.href,max:1});
 const backupDir=join(root,'.runtime/backups');await mkdir(backupDir,{recursive:true});const file=join(backupDir,'studio-'+randomUUID()+'.dump');
 await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');transaction=true;
 const before=await fingerprint(source),snapshot=(await source.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
 const env={...process.env,PGPASSWORD:config.adminPassword};
 const args=['-h','127.0.0.1','-p','54329','-U','learning_admin'];
 await run(join(resolve(process.env.PG_BIN),'pg_dump.exe'),[...args,'-d','learning_platform','-Fc','--snapshot='+snapshot,'--file='+file],{env,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
 await source.query('COMMIT');transaction=false;
 scratch='studio_restore_'+randomUUID().replaceAll('-','');if(!/^studio_restore_[0-9a-f]{32}$/.test(scratch))throw new Error('演练数据库名校验失败。');
 await admin.query('CREATE DATABASE "'+scratch+'" OWNER learning_app');created=true;const restoreURL=new URL(adminURL);restoreURL.pathname='/'+scratch;
 await run(join(resolve(process.env.PG_BIN),'pg_restore.exe'),[...args,'-d',scratch,'--exit-on-error',file],{env,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
 restored=new Pool({connectionString:restoreURL.href,max:1});const after=await fingerprint(restored);if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('恢复后的记录指纹不一致；备份保留，请检查。');
 const rls=(await restored.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace=$2::regnamespace AND relname=ANY($1::text[])',[protectedTables,'public'])).rows;
 if(rls.length!==protectedTables.length||rls.some(r=>!r.relrowsecurity||!r.relforcerowsecurity))throw new Error('恢复后的权限策略未启用。');
 const restoredAppURL=new URL(appURL);restoredAppURL.pathname='/'+scratch;application=new Pool({connectionString:restoredAppURL.href,max:1});await application.query('BEGIN');await application.query("SELECT set_config('app.user_id','restore-unrelated-fixture',true)");
 for(const table of protectedTables){const count=(await application.query('SELECT count(*)::int AS n FROM "'+table+'"')).rows[0].n;if(count!==0)throw new Error('恢复后的用户隔离检查失败。');}await application.query('ROLLBACK');
 console.log(JSON.stringify({backup:file,bytes:(await stat(file)).size,matchedTables:before.map(({table,count})=>({table,count})),ownerIsolation:'passed',restore:'passed',originalDatabase:'not overwritten'},null,2));
}catch(error){console.error(error instanceof Error&&/^(恢复|请将|演练)/.test(error.message)?error.message:'备份恢复演练失败，未输出数据库凭据；请检查工具和服务。');process.exitCode=1;}finally{
 if(transaction)await source?.query('ROLLBACK');await application?.end();await restored?.end();await source?.end();
 if(created&&admin){await admin.query('DROP DATABASE IF EXISTS "'+scratch+'"');}await admin?.end();
}
