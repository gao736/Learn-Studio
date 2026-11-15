import {pool} from '../src/server/db.ts';
try{
 const local=process.env.LOCAL_MAILBOX==='true',key=!!process.env.SILICONFLOW_API_KEY,model=process.env.SILICONFLOW_MODEL||'Qwen/Qwen3.5-4B';
 const schema=(await pool.query("SELECT to_regclass('public.study_plans') IS NOT NULL AS plans,to_regclass('public.weekly_sessions') IS NOT NULL AS weekly,to_regclass('pgboss.job') IS NOT NULL AS queue")).rows[0];
 const jobs=schema.queue?(await pool.query("SELECT name,state,count(*)::int AS count FROM pgboss.job WHERE name=ANY($1::text[]) AND state IN ('created','retry','active') GROUP BY name,state ORDER BY name,state",[ [process.env.COURSE_QUEUE||'course-generate',process.env.ASSESSMENT_QUEUE||'assessment-ai-check'] ])).rows:[];
 console.log(JSON.stringify({database:'connected',schema,mailMode:local?'local-test':'real-smtp',smtpConfigured:!!process.env.SMTP_HOST,model,keyConfigured:key,assessmentWorkerConfigured:!!process.env.ASSESSMENT_WORKER_DATABASE_URL,pendingJobs:jobs,limits:{modelMonthlyBudgetFen:Number(process.env.MODEL_MONTHLY_BUDGET_FEN||35000),modelDailyBudgetFen:Number(process.env.MODEL_DAILY_BUDGET_FEN||1000)}},null,2));
 if(!schema.plans||!schema.weekly)throw new Error('MVP迁移尚未完成。');
 if(process.argv.includes('--assert-idle')&&jobs.length)throw new Error('仍有持久化任务，请先核对任务授权与状态，不自动启动消费。');
}catch(error){console.error(error instanceof Error&&/^(MVP|仍有)/.test(error.message)?error.message:'状态检查失败，请检查本机服务和配置；未输出连接凭据。');process.exitCode=1;}finally{await pool.end();}
