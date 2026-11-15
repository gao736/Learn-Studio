import {test,expect,submitRegistration} from './fixtures';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {pool} from '../../src/server/db.ts';
test.setTimeout(150000);
test('continuous study creates a saved three-lesson plan, opens the current lesson and preserves prerequisite locks',async({page})=>{
 const email=`study-${randomUUID()}@example.test`;
 try{
  await page.goto('/register');await page.getByLabel('称呼').fill('连续学习验收');await page.getByLabel('邮箱').fill(email);await page.getByLabel('密码',{exact:true}).fill('Local-Study-passphrase-94!');
  await submitRegistration(page);
  let link='';for(let i=0;i<40&&!link;i++){for(const file of (await readdir('.runtime/mail')).sort().reverse()){const m=JSON.parse(await readFile(`.runtime/mail/${file}`,'utf8'));if(m.to.includes(email)){link=m.text.match(/http:\/\/127\.0\.0\.1:3000\/[^\s<>]+/)[0];break;}}if(!link)await new Promise(r=>setTimeout(r,250));}
  expect(link).not.toBe('');await page.goto(link);await page.goto('/courses');
  await page.getByRole('link',{name:'开始天文学连续学习',exact:true}).click();
  await expect(page.getByRole('heading',{name:'建立连续学习计划',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'确认并保存学习计划',exact:true}).click();await expect(page).toHaveURL(/\/study\/[0-9a-f-]+$/);
  const saved=page.url();
  await page.goto('/today');await expect(page.getByRole('heading',{name:'今天，从下一步开始。',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'打开当前学习计划',exact:true})).toHaveAttribute('href',new URL(saved).pathname);await expect(page.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'周测',exact:true})).toBeVisible();await page.goto(saved);
  await expect(page.getByRole('heading',{name:'连续学习计划',exact:true})).toBeVisible();
  await expect(page.getByText('前置尚未通过',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'继续下一项学习',exact:true}).click();await expect(page).toHaveURL(/\/lesson\/astronomy$/);
  await page.goto(saved);await expect(page.locator('.study-task').filter({hasText:'已开始'}).first()).toBeVisible();
  await page.goto('/lesson/astronomy');
  for(const [id,value] of Object.entries({q1:'1',q2:'0',q3:'2',q4:'1',q5:'0'}))await page.locator(`input[name="${id}"][value="${value}"]`).check();
  await page.getByRole('button',{name:'提交并保存结果',exact:true}).click();await expect(page).toHaveURL(/\/results\//);await page.goto(saved);
  await expect(page.getByRole('status').filter({hasText:'学习环节完成 1 / 3'})).toBeVisible();
  await expect(page.locator('.study-task').filter({hasText:'自主练习与独立考核'}).first()).not.toContainText('已完成');
  for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.runtime/studio-plan-${width}.png`,fullPage:false});}
  await page.goto('/today');await expect(page.getByRole('link',{name:'查看保存的反馈',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'进入间隔复习',exact:true})).toBeVisible();
  for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===375||width===1440)await page.screenshot({path:'.runtime/studio-today-'+width+'.png',fullPage:false});}
  await page.setViewportSize({width:375,height:950});await page.evaluate(()=>{const sizes=[...document.querySelectorAll<HTMLElement>('body, body *')].map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)}));for(const {el,size} of sizes)el.style.fontSize=size*2+'px';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.runtime/studio-today-zoom.png',fullPage:false});await page.reload();
  await page.goto('/today');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'跳到主要内容',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
  await page.goto(saved);await page.reload();await expect(page.getByRole('heading',{name:'连续学习计划',exact:true})).toBeVisible();
 }finally{await pool.query('DELETE FROM "user" WHERE email=$1',[email]);}
});
