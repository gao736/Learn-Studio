import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {Pool} from 'pg';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {pool,withUserDatabase} from '../../src/server/db.ts';
import {withAIDatabase} from '../../src/server/ai-db.ts';
import {createCandidate} from '../../src/features/assessment/repository.ts';
import {fixtureMaterial} from '../fixtures/course.ts';
import {astronomyPack} from '../../src/features/assessment/catalog.ts';
const baseURL=process.env.BETTER_AUTH_URL||'http://127.0.0.1:3000';
test.setTimeout(150000);

async function register(page:Page,email:string){
  await page.goto('/register');await page.getByLabel('称呼').fill('M03浏览器验收');await page.getByLabel('邮箱').fill(email);await page.getByLabel('密码',{exact:true}).fill('Local-M03-passphrase-94!');
  const response=page.waitForResponse(r=>r.url().includes('/api/auth/sign-up/email')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'创建账户'}).click();const registration=await response;
  if(registration.status()===429){
    const retry=Number(registration.headers()['retry-after']||60);
    await new Promise(resolve=>setTimeout(resolve,(Math.min(60,Math.max(1,Number.isFinite(retry)?retry:60))+1)*1000));
    await page.getByRole('button',{name:'创建账户'}).click();
  }
  await expect(page.getByRole('status')).toContainText('注册请求已受理');
  let link='';for(let retry=0;retry<40&&!link;retry++){
    for(const file of (await readdir('.runtime/mail')).sort().reverse()){const m=JSON.parse(await readFile(`.runtime/mail/${file}`,'utf8'));if(m.to.includes(email)){link=m.text.match(/http:\/\/127\.0\.0\.1:\d+\/[^\s<>]+/)[0];break;}}
    if(!link)await new Promise(r=>setTimeout(r,250));
  }
  expect(link).not.toBe('');await page.goto(link);
}
test('M03 diagnoses, excludes helped answers, remediates with new questions, unlocks and saves manual review',async({page,browser})=>{
  const student=`m03-${Date.now()}@example.test`,staff=`m03-review-${Date.now()}@example.test`;
  const local=JSON.parse(await readFile('.runtime/local-db.json','utf8'));
  const admin=new Pool({host:'127.0.0.1',port:54329,database:'learning_platform',user:'learning_admin',password:local.adminPassword});
  const staffContext=await browser.newContext({baseURL});const staffPage=await staffContext.newPage();
  try{
    await register(page,student);await page.setViewportSize({width:375,height:950});
    await page.getByRole('link',{name:'进入能力诊断'}).click();
    await page.getByRole('link',{name:'查看技能与进度'}).click();
    for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.runtime/m03-${width}.png`,fullPage:true});}
    await page.setViewportSize({width:375,height:950});
    await page.goto('/assessments/astronomy/life');await expect(page.getByRole('heading',{name:'本课尚未解锁'})).toBeVisible();await expect(page.locator('body')).not.toContainText('红巨星');
    await page.goto('/assessments/astronomy');
    await page.getByRole('button',{name:'诊断基础',exact:true}).first().click();
    await expect(page).toHaveURL(/\/assessments\/session\/[0-9a-f-]+$/);
    const firstId=page.url().split('/').at(-1)!;
    const unexposed=await page.request.get(`/api/assessments/${firstId}`);expect(unexposed.status()).toBe(200);expect(JSON.stringify(await unexposed.json())).not.toContain('correctIndex');
    const anon=await browser.newContext({baseURL});expect((await anon.request.get(`/api/assessments/${firstId}`)).status()).toBe(401);await anon.close();
    await page.getByRole('button',{name:'查看答案 / 评分依据',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('不计独立证据');await page.reload();await expect(page.getByRole('status')).toContainText('不计独立证据');
    for(const [family,choice] of [['energy','1'],['identity','0'],['reflection','2'],['satellite','1'],['orbit','0']])await page.locator(`input[name="light-${family}-1"][value="${choice}"]`).check();
    await admin.query('REVOKE UPDATE ON assessment_sessions FROM learning_app');
    try{await page.getByRole('button',{name:'提交独立作答'}).click();await expect(page.locator('.quiz-form [role="alert"]')).toContainText('暂时无法保存');await expect(page.locator('.quiz-form [role="alert"]')).toBeFocused();expect(await page.locator('input:checked').count()).toBe(5);}
    finally{await admin.query('GRANT UPDATE ON assessment_sessions TO learning_app');}
    await page.getByRole('button',{name:'提交独立作答'}).click();await expect(page.getByRole('heading',{name:'结果已保存'})).toBeVisible();await expect(page.getByText('证据尚未达标',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'返回当前技能补习'}).click();await expect(page.getByRole('heading',{name:'针对性补习'})).toBeVisible();
    await page.getByRole('button',{name:'独立考核 / 新题补测'}).click();
    for(const [family,choice] of [['energy','0'],['identity','2'],['reflection','0'],['satellite','0'],['orbit','1']])await page.locator(`input[name="light-${family}-2"][value="${choice}"]`).check();
    await page.getByRole('button',{name:'提交独立作答'}).click();await expect(page.getByText('达到初始通过门槛',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('达到初始通过门槛',{exact:true})).toBeVisible();
    await page.goto('/assessments/astronomy/life');await expect(page.getByRole('heading',{name:'理解恒星的一生',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'跳级测验'}).click();
    for(const [family,choice] of [['birth','1'],['gravity','0'],['sequence','2'],['lifetime','0']])await page.locator(`input[name="life-${family}-1"][value="${choice}"]`).check();
    await page.getByLabel('你的独立解释（等待人工复核）').fill('白矮星');await page.getByRole('button',{name:'提交独立作答'}).click();await expect(page.getByText('等待评分复核',{exact:true})).toBeVisible();
    const lifeId=page.url().split('/').at(-1)!;
    await register(staffPage,staff);
    // Run the local operator command on this test account only; no self-grant endpoint.
    execFileSync(process.execPath,['scripts/reviewer.ts','grant',staff],{windowsHide:true});
    expect((await staffPage.request.get(`/api/assessments/${lifeId}`)).status()).toBe(404);
    await staffPage.goto('/assessments/review');await expect(staffPage.getByRole('heading',{name:'授权复核工作台'})).toBeVisible();
    const review=staffPage.locator('.review-card').filter({hasText:'太阳这样的恒星晚年通常留下哪类致密核心'});
    await review.getByLabel('结论',{exact:true}).selectOption('true');await review.getByLabel('来源与评分依据').fill('NASA恒星演化资料支持太阳最终留下白矮星，回答符合题意。');await review.getByRole('button',{name:'保存复核决定'}).click();
    await expect(review).toHaveCount(0);
    await page.reload();await expect(page.getByText('达到初始通过门槛',{exact:true})).toBeVisible();await expect(page.getByText(/复核结论：符合评分依据/)).toBeVisible();
    await page.goto('/assessments/review');await expect(page.getByRole('heading',{name:'没有复核权限'})).toBeVisible();
    execFileSync(process.execPath,['scripts/reviewer.ts','revoke',staff],{windowsHide:true});
    await staffPage.goto('/assessments/review');await expect(staffPage.getByRole('heading',{name:'没有复核权限'})).toBeVisible();
  }finally{
    await admin.query('GRANT UPDATE ON assessment_sessions TO learning_app');
    await admin.query('DELETE FROM "user" WHERE email=ANY($1::text[])',[[student,staff]]);
    await staffContext.close();await admin.end();
  }
});

test('M03 AI learning shows honest status, preserves helped evidence and unlocks with fresh retest',async({page})=>{
  const email=`m03-ai-ui-${Date.now()}@example.test`;await register(page,email);
  const owner=(await pool.query('SELECT id FROM "user" WHERE email=$1',[email])).rows[0].id;
  const course=randomUUID(),check=randomUUID();
  try{
    await withUserDatabase(owner,c=>c.query("INSERT INTO learning_courses(id,owner_id,submission_key,goal,schedule,status,material,sources,provenance,active_generation) VALUES($1,$2,$3,$4,'[]','ready',$5,$6,'real',$7)",[course,owner,randomUUID(),JSON.stringify({topic:'M03 AI浏览器模拟夹具'}),JSON.stringify(fixtureMaterial),JSON.stringify(astronomyPack.sources),randomUUID()]));
    const id=await createCandidate(owner,course);
    await page.goto(`/assessments/${id}`);await expect(page.getByRole('heading',{name:'题库等待核对'})).toBeVisible();
    await page.getByRole('button',{name:'AI 核对题库',exact:true}).click();await expect(page.locator('.assessment-form [role="alert"]')).toContainText('硅基流动尚未配置');
    const pack=structuredClone(astronomyPack);pack.title='M03 AI浏览器模拟夹具（无真实模型调用）';pack.questions=pack.questions.map(q=>q.type==='written'?{...q,type:'choice',options:['白矮星','行星','分子云'],correctIndex:0}:q);
    await withUserDatabase(owner,c=>c.query("INSERT INTO assessment_ai_checks(id,owner_id,pack_id,course_version,budget_day,model_name,status,proposed_spec,accounted_fen) VALUES($1,$2,$3,'fixture','2020-01-01','fixture','queued',$4,20)",[check,owner,id,JSON.stringify(pack)]));
    // Explicit backend fixture solely exercises the UI; it is not a real AI check or learner result.
    await withAIDatabase(owner,async c=>{await c.query("UPDATE assessment_ai_checks SET status='completed',checked_spec=$2,accounted_fen=0,report=$3 WHERE id=$1",[check,JSON.stringify(pack),JSON.stringify({simulation:true})]);await c.query("UPDATE assessment_packs SET status='approved',approval_mode='ai',spec=$2 WHERE id=$1",[id,JSON.stringify(pack)]);});
    await page.reload();await expect(page.getByText('AI 评估，待验证。题库已对照来源自动核对',{exact:false})).toBeVisible();await expect(page.locator('.page-heading')).not.toContainText('人工核对题库');
    for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.runtime/m03-ai-${width}.png`,fullPage:true});}
    await page.goto(`/assessments/${id}/life`);await expect(page.getByRole('heading',{name:'本课尚未解锁'})).toBeVisible();
    await page.goto(`/assessments/${id}`);await page.getByRole('button',{name:'诊断基础',exact:true}).first().click();
    await expect(page).toHaveURL(/\/assessments\/session\//);const firstURL=page.url();
    await page.getByRole('button',{name:'查看提示',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('不计独立证据');
    await page.reload();await expect(page.getByRole('status')).toContainText('不计独立证据');
    for(const q of pack.questions.filter(q=>q.skill==='light'&&q.id.endsWith('-1')))await page.locator(`input[name="${q.id}"][value="${q.correctIndex}"]`).check();
    await page.getByRole('button',{name:'提交独立作答'}).click();await expect(page.getByText('证据尚未达标',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'返回当前技能补习'}).click();await expect(page.getByRole('heading',{name:'针对性补习'})).toBeVisible();
    await page.getByRole('button',{name:'独立考核 / 新题补测'}).click();
    for(const q of pack.questions.filter(q=>q.skill==='light'&&q.id.endsWith('-2')))await page.locator(`input[name="${q.id}"][value="${q.correctIndex}"]`).check();
    await page.getByRole('button',{name:'提交独立作答'}).click();await expect(page.getByText('达到初始通过门槛',{exact:true})).toBeVisible();const saved=page.url();await page.reload();await expect(page.getByRole('heading',{name:'结果已保存'})).toBeVisible();
    await page.goto(`/assessments/${id}/life`);await expect(page.getByRole('heading',{name:'理解恒星的一生',exact:true})).toBeVisible();
    await page.goto(saved);await page.setViewportSize({width:1440,height:950});await page.getByRole('button',{name:'退出登录'}).click();await expect(page).toHaveURL(/\/login(?:\?|$)/);await page.getByLabel('邮箱').fill(email);await page.getByLabel('密码',{exact:true}).fill('Local-M03-passphrase-94!');await page.getByRole('button',{name:'登录并继续'}).click();await expect(page).toHaveURL(/\/today/);await page.goto(saved);await expect(page.getByRole('heading',{name:'结果已保存'})).toBeVisible();await page.goto(firstURL);await expect(page.getByText('使用帮助，不计独立证据',{exact:false})).toBeVisible();
  }finally{await pool.query('DELETE FROM "user" WHERE id=$1',[owner]);}
});
