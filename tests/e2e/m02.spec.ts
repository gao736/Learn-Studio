import { test, expect } from './fixtures';
import { readdir,readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixtureMaterial } from '../fixtures/course';
import { Pool } from 'pg';
import {reviseCourse} from '../../src/features/course/repository';
import {pool} from '../../src/server/db';


test('M02 saves a custom plan, reports absent provider configuration, and teaches an explicitly simulated first lesson', async ({page,browser}) => {
  const email = `m02-${Date.now()}@example.test`;
  const password = 'Local-m02-passphrase-93!';
  await page.goto('/register');
  await page.getByLabel('称呼').fill('自定义课程学习者');
  await page.getByLabel('邮箱').fill(email); await page.getByLabel('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'创建账户'}).click();
  await expect(page.getByRole('status')).toContainText('注册请求已受理');
  let verification = '';
  for (let retry=0; retry<40 && !verification; retry++) {
    for (const file of (await readdir('.runtime/mail')).sort().reverse()) {
      const mail = JSON.parse(await readFile(`.runtime/mail/${file}`,'utf8'));
      if (mail.to.includes(email)) { verification=mail.text.match(/http:\/\/127\.0\.0\.1:\d+\/[^\s<>]+/)[0]; break; }
    }
    if (!verification) await new Promise(r=>setTimeout(r,250));
  }
  expect(verification).not.toBe(''); await page.goto(verification);
  await page.setViewportSize({width:375,height:950});
  await page.goto('/courses/new');
  await page.getByLabel('想学习什么').fill('天文学');
  await page.getByLabel('学习天数').fill('9');
  await page.getByLabel('开始日期').fill('2026-10-30');
  await page.getByRole('button',{name:'查看学习范围'}).click();
  await expect(page.getByRole('heading',{name:'确认这次学习范围'})).toBeVisible();
  await expect(page.locator('.scope-preview')).toContainText('发送至硅基流动');await expect(page.locator('.scope-preview')).toContainText('免费文本模型');
  await page.getByRole('button',{name:'确认范围并保存课程'}).click();
  await expect(page.getByRole('heading',{name:'天文学',exact:true})).toBeVisible();
  const courseId = page.url().split('/').at(-1)!;
  await expect(page.getByText('2026-11',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'开始生成第一课'}).click();
  await expect(page.locator('.course-error')).toContainText('硅基流动尚未配置');
  await page.reload(); await expect(page.locator('.course-error')).toContainText('硅基流动尚未配置');
  const privateStatus = await page.request.get(`/api/courses/${courseId}`);
  expect(privateStatus.status()).toBe(200);
  expect(JSON.stringify(await privateStatus.json())).not.toContain('correctIndex');
  const anonymous = await browser.newContext({baseURL:process.env.BETTER_AUTH_URL||'http://127.0.0.1:3000'});
  expect((await anonymous.request.get(`/api/courses/${courseId}`)).status()).toBe(401);
  await anonymous.close();

  // Test-only DB fixture; bypass only the external provider, not auth, rendering or grading.
  const database = new Pool({connectionString:process.env.DATABASE_URL});
  const actor = (await database.query('SELECT id FROM "user" WHERE email=$1',[email])).rows[0].id;
  const simulated = structuredClone(fixtureMaterial); simulated.weeklyTopics.push('天空观察');
  const sources = [{id:'s1',url:'https://science.nasa.gov/universe/stars/',title:'模拟来源；未抓取验证',fetchedAt:new Date().toISOString(),digest:'simulation'}];
  const client = await database.connect();
  try {
    await client.query('BEGIN'); await client.query("SELECT set_config('app.user_id',$1,true)",[actor]);
    const schedule = (await client.query('SELECT schedule FROM learning_courses WHERE id=$1',[courseId])).rows[0].schedule;
    for (const day of schedule) day.focus = simulated.weeklyTopics[day.week-1];
    await client.query("UPDATE learning_courses SET material=$2,sources=$3,schedule=$4,status='ready',error='',provenance='simulation',active_generation=$5 WHERE id=$1",[courseId,JSON.stringify(simulated),JSON.stringify(sources),JSON.stringify(schedule),randomUUID()]);
    await client.query('COMMIT');
  } finally { client.release(); await database.end(); }
  await page.reload();
  await expect(page.getByText('模拟测试课程')).toBeVisible();
  for (const width of [375,768,1024,1440]) {
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`.runtime/m02-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:375,height:950});
  await page.getByRole('link',{name:'学习第一课'}).click();
  await expect(page.getByText('模拟测试课程',{exact:true})).toBeVisible();
  for (const [index,choice] of [1,0,2,1,0].entries()) await page.locator(`input[name="q${index+1}"][value="${choice}"]`).check();
  const oldVersion=(await page.locator('input[name="lesson_version"]').getAttribute('value'))!;
  const revised=structuredClone(simulated);revised.lesson.sections.push({heading:'修订补充讲解',body:'本段为模拟版本验收，原讲义和作答历史保留。',sourceIds:['s1']});
  await reviseCourse(actor,courseId,oldVersion,revised,'浏览器旧页面提交防护验收；无真实模型调用');
  await page.getByRole('button',{name:'提交并保存结果'}).click();
  await expect(page.getByRole('alert').filter({hasText:'课程版本已更新'})).toBeVisible();
  await expect(page.locator('input[name="q1"][value="1"]')).toBeChecked();
  await page.reload();await expect(page.getByRole('heading',{name:'修订补充讲解'})).toBeVisible();
  expect(await page.locator('input[name="lesson_version"]').getAttribute('value')).toBe(`${oldVersion}:r1`);
  for (const [index,choice] of [1,0,2,1,0].entries()) await page.locator(`input[name="q${index+1}"][value="${choice}"]`).check();
  for(const width of [375,1440]){
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.runtime/m02-version-lesson-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:375,height:950});
  await page.getByRole('button',{name:'提交并保存结果'}).click();
  await expect(page.getByText('5 / 5',{exact:true})).toBeVisible();
  await expect(page.getByText(/模拟作答记录/)).toBeVisible();
  await page.reload(); await expect(page.getByText('5 / 5',{exact:true})).toBeVisible();
  const resultURL=page.url();await expect(page.getByText(`课程版本 ${oldVersion}:r1`,{exact:false})).toBeVisible();
  await page.setViewportSize({width:1440,height:950});
  await page.getByRole('button',{name:'退出登录'}).click();await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('邮箱').fill(email);await page.getByLabel('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'登录并继续'}).click();await expect(page).toHaveURL(/\/today$/);
  await page.goto(resultURL);await expect(page.getByText('5 / 5',{exact:true})).toBeVisible();
});
