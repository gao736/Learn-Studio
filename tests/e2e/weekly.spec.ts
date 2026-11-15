import {test,expect} from './fixtures';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {pool,withUserDatabase} from '../../src/server/db.ts';
import {createStudyPlan} from '../../src/features/study/repository.ts';
import {startAssessment,submitAssessment} from '../../src/features/assessment/repository.ts';
import {astronomyPack} from '../../src/features/assessment/catalog.ts';
import {todayInShanghai,buildSchedule} from '../../src/features/course/domain.ts';
import {buildStudyPlan} from '../../src/features/study/domain.ts';
test('weekly quiz saves feedback, previews and confirms one adjustment, and preserves history on recovery',async({page})=>{
 test.setTimeout(150000);const email='weekly-'+randomUUID()+'@example.test';
 try{
  await page.goto('/register');await page.getByLabel('称呼').fill('周测验收');await page.getByLabel('邮箱').fill(email);await page.getByLabel('密码',{exact:true}).fill('Local-Weekly-passphrase-94!');
  await page.getByRole('button',{name:'创建账户'}).click();await expect(page.getByRole('status')).toContainText('注册请求已受理');
  let link='';for(let i=0;i<40&&!link;i++){for(const file of (await readdir('.runtime/mail')).sort().reverse()){const m=JSON.parse(await readFile('.runtime/mail/'+file,'utf8'));if(m.to.includes(email)){link=m.text.match(/http:\/\/127\.0\.0\.1:3000\/[^\s<>]+/)[0];break;}}if(!link)await new Promise(r=>setTimeout(r,250));}expect(link).not.toBe('');await page.goto(link);
  const user=(await pool.query('SELECT id FROM "user" WHERE email=$1',[email])).rows[0].id;
  const plan=await createStudyPlan(user,'astronomy',todayInShanghai()),s=await startAssessment(user,'astronomy','light','diagnosis');await submitAssessment(user,s.id,Object.fromEntries(s.questions.map(q=>[q.id,String(q.correctIndex)])));
  const date=new Date(todayInShanghai()+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-6);const goal={topic:'天文',goal:'基础',days:30,dailyMinutes:30,startDate:date.toISOString().slice(0,10),sourceUrls:[]};
  const payload=buildStudyPlan(goal,buildSchedule(goal),plan.payload.units,goal.startDate);payload.days[0].tasks[0].state='started';await withUserDatabase(user,c=>c.query('UPDATE study_plans SET payload=$2 WHERE id=$1',[plan.id,JSON.stringify(payload)]));
  await page.goto('/study/'+plan.id+'/weekly');await expect(page.getByRole('heading',{name:'每周回顾与调整',exact:true})).toBeVisible();await page.getByRole('button',{name:'开始或继续本周测验',exact:true}).click();await expect(page).toHaveURL(/\/weekly\/session\//);
  await expect(page.locator('fieldset.question')).toHaveCount(5);
  for(const q of astronomyPack.questions.filter(q=>q.type==='choice')){const radio=page.locator('input[name="'+q.id+'"][value="'+((q.correctIndex!+1)%q.options!.length)+'"]');if(await radio.count())await radio.check();}
  await expect(page.locator('input[type=radio]:checked')).toHaveCount(5);
  await page.getByRole('button',{name:'提交并保存周测',exact:true}).click();await expect(page.getByRole('heading',{name:'周测结果已保存',exact:true})).toBeVisible();await expect(page.getByText('本次答对 0 / 5',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'确认前查看调整',exact:true})).toBeVisible();await page.getByRole('button',{name:'确认调整后续安排',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'调整已保存'})).toBeVisible();await page.reload();await expect(page.getByRole('status').filter({hasText:'调整已保存'})).toBeVisible();
  for(const width of [375,768,1024,1440]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===375||width===1440)await page.screenshot({path:'.runtime/studio-weekly-'+width+'.png',fullPage:false});}
  await page.goto('/study/'+plan.id);await page.getByText('学习计划历史',{exact:false}).click();await page.getByRole('link',{name:'查看版本0',exact:true}).click();await expect(page.getByRole('heading',{name:'学习计划历史版本0',exact:true})).toBeVisible();
  await page.goto('/study/'+plan.id);const next=new Date(todayInShanghai()+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+3);await page.getByLabel('恢复学习日期').fill(next.toISOString().slice(0,10));await page.getByRole('button',{name:'确认恢复未开始的安排',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'恢复安排已保存'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'连续学习计划',exact:true})).toBeVisible();
 }finally{await pool.query('DELETE FROM "user" WHERE email=$1',[email]);}
});
