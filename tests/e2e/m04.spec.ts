import {test,expect} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {Pool} from 'pg';
test('M04 recalls due cards, preserves failed inputs, saves FSRS once and resumes the next review',async({page,browser})=>{
  const email=`m04-${Date.now()}@example.test`;
  const local=JSON.parse(await readFile('.runtime/local-db.json','utf8'));
  const admin=new Pool({host:'127.0.0.1',port:54329,database:'learning_platform',user:'learning_admin',password:local.adminPassword});
  try{
    await page.goto('/register');await page.getByLabel('称呼').fill('M04浏览器验收');await page.getByLabel('邮箱').fill(email);await page.getByLabel('密码',{exact:true}).fill('Local-M04-passphrase-94!');await page.getByRole('button',{name:'创建账户'}).click();await expect(page.getByRole('status')).toContainText('注册请求已受理');
    let link='';for(let retry=0;retry<40&&!link;retry++){
      for(const file of (await readdir('.runtime/mail')).sort().reverse()){const m=JSON.parse(await readFile(`.runtime/mail/${file}`,'utf8'));if(m.to.includes(email)){link=m.text.match(/http:\/\/127\.0\.0\.1:3000\/[^\s<>]+/)[0];break;}}
      if(!link)await new Promise(r=>setTimeout(r,250));
    }
    expect(link).not.toBe('');await page.goto(link);await page.goto('/reviews');await expect(page.getByRole('heading',{name:'先完成一次学习'})).toBeVisible();
    await page.getByRole('link',{name:'进入天文学示例课'}).click();
    for(const [i,choice] of ['1','0','2','1','0'].entries())await page.locator(`input[name="q${i+1}"][value="${choice}"]`).check();
    await page.getByRole('button',{name:'提交并保存结果'}).click();await expect(page).toHaveURL(/\/results\//);
    await page.goto('/today');await page.getByRole('link',{name:'进入间隔复习'}).click();await expect(page.getByRole('button',{name:'开始回忆'})).toHaveCount(5);
    for(const width of [375,768,1024,1440]){
      await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const targets=await page.locator('nav a').evaluateAll(elements=>elements.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));expect(targets.every(t=>t.w>=44&&t.h>=44)).toBe(true);
      await page.screenshot({path:`.runtime/m04-${width}.png`,fullPage:true});
    }
    await page.setViewportSize({width:375,height:950});
    // Text-only enlargement at 200%, preserving the viewport and original stylesheet values.
    await page.evaluate(()=>{
      const sizes=Array.from(document.body.querySelectorAll<HTMLElement>('*')).map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));
      sizes.forEach(({e,size})=>{e.dataset.originalFont=e.style.fontSize;e.style.fontSize=`${size*2}px`;});
    });
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'.runtime/m04-text-200.png',fullPage:true});
    await page.evaluate(()=>document.querySelectorAll<HTMLElement>('[data-original-font]').forEach(e=>{e.style.fontSize=e.dataset.originalFont!;delete e.dataset.originalFont;}));
    const user=(await admin.query('SELECT id FROM "user" WHERE email=$1',[email])).rows[0].id;
    const card=(await admin.query('SELECT id,question FROM review_cards WHERE owner_id=$1 ORDER BY due,id LIMIT 1',[user])).rows[0];
    await page.getByRole('button',{name:'开始回忆'}).first().click();await expect(page).toHaveURL(/\/reviews\/session\//);
    const id=page.url().split('/').at(-1)!;
    const response=await page.request.get(`/api/reviews/${id}`);expect(response.status()).toBe(200);const publicData=await response.json();expect(publicData.feedback).toBe(null);expect(JSON.stringify(publicData)).not.toContain('correctIndex');expect(JSON.stringify(publicData)).not.toContain('explanation');
    const anon=await browser.newContext({baseURL:'http://127.0.0.1:3000'});expect((await anon.request.get(`/api/reviews/${id}`)).status()).toBe(401);await anon.close();
    const wrong=(card.question.correctIndex+1)%card.question.options.length;
    const radio=page.locator(`input[name="answer"][value="${wrong}"]`);await radio.focus();await radio.press('Space');await expect(radio).toBeChecked();await page.getByLabel('这次回忆的难度').selectOption('easy');
    await admin.query('REVOKE UPDATE ON review_cards FROM learning_app');
    try{const submit=page.getByRole('button',{name:'保存回忆与下次时间'});await submit.focus();await submit.press('Enter');await expect(page.locator('.assessment-form [role="alert"]')).toContainText('暂时无法保存');await expect(page.locator('.assessment-form [role="alert"]')).toBeFocused();expect(await page.locator('input[name="answer"]:checked').inputValue()).toBe(String(wrong));await expect(page.getByLabel('这次回忆的难度')).toHaveValue('easy');}
    finally{await admin.query('GRANT UPDATE ON review_cards TO learning_app');}
    await page.getByRole('button',{name:'保存回忆与下次时间'}).click();await expect(page.getByRole('heading',{name:'复习结果已保存'})).toBeVisible();await expect(page.getByText('需要重学',{exact:true})).toBeVisible();await expect(page.locator('.hint-box')).toContainText('下次复习');
    const first=(await admin.query('SELECT revision,memory FROM review_cards WHERE id=$1',[card.id])).rows[0];expect(first.revision).toBe(1);expect(first.memory.reps).toBe(1);
    await page.reload();await expect(page.getByText('需要重学',{exact:true})).toBeVisible();expect((await page.request.get(`/api/reviews/${id}`)).status()).toBe(200);
    await page.screenshot({path:'.runtime/m04-feedback-375.png',fullPage:true});
    await page.getByRole('link',{name:'继续到期任务'}).click();await expect(page.getByRole('button',{name:'开始回忆'})).toHaveCount(4);
    await page.getByText('补入以前完成的练习',{exact:true}).click();await page.getByRole('button',{name:'同步既有学习记录'}).click();await expect(page.getByRole('status')).toContainText('新增 0');
    // Only this test account's due field is changed to exercise the future return, not product time.
    await admin.query("UPDATE review_cards SET due=now()+interval '1 day' WHERE owner_id=$1",[user]);await admin.query("UPDATE review_cards SET due=now()-interval '1 minute' WHERE id=$1",[card.id]);
    await page.reload();await expect(page.getByRole('button',{name:'开始回忆'})).toHaveCount(1);await page.getByRole('button',{name:'开始回忆'}).click();expect(page.url().split('/').at(-1)).not.toBe(id);
    await page.locator(`input[name="answer"][value="${card.question.correctIndex}"]`).check();await page.getByRole('button',{name:'保存回忆与下次时间'}).click();await expect(page.getByText('回忆正确',{exact:true})).toBeVisible();
    expect((await admin.query('SELECT revision FROM review_cards WHERE id=$1',[card.id])).rows[0].revision).toBe(2);
    await page.getByRole('link',{name:'继续到期任务'}).click();await expect(page.getByRole('heading',{name:'当前没有到期任务'})).toBeVisible();await expect(page.locator('.review-history li')).toHaveCount(2);
    // A different verified account is not needed for API ownership: reuse an isolated auth session with a fixture user.
    const other=await browser.newContext({baseURL:'http://127.0.0.1:3000'});
    const otherEmail=`m04-other-${Date.now()}@example.test`;
    try{await other.request.post('/api/auth/sign-up/email',{data:{name:'M04隔离',email:otherEmail,password:'Local-M04-passphrase-94!'},headers:{Origin:'http://127.0.0.1:3000'}});await admin.query('UPDATE "user" SET "emailVerified"=true WHERE email=$1',[otherEmail]);await other.request.post('/api/auth/sign-in/email',{data:{email:otherEmail,password:'Local-M04-passphrase-94!'},headers:{Origin:'http://127.0.0.1:3000'}});expect((await other.request.get(`/api/reviews/${id}`)).status()).toBe(404);}
    finally{await other.close();await admin.query('DELETE FROM "user" WHERE email=$1',[otherEmail]);}
  }finally{await admin.query('GRANT UPDATE ON review_cards TO learning_app');await admin.query('DELETE FROM "user" WHERE email=$1',[email]);await admin.end();}
});
