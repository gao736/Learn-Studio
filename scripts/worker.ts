import { getBoss, courseQueue } from '../src/server/queue.ts';
import { runGeneration } from '../src/features/course/generate.ts';
import { pool } from '../src/server/db.ts';
const boss = await getBoss();
await boss.work<{ownerId:string;generationId:string}>(courseQueue,{batchSize:1,pollingIntervalSeconds:2},async jobs => {
  for (const job of jobs) await runGeneration(job.data);
});
console.log('课程后台任务已启动；只处理当前数据库已授权的持久化任务。');
async function stop() { await boss.stop(); await pool.end(); }
process.on('SIGINT',()=>void stop()); process.on('SIGTERM',()=>void stop());
