import type {Page} from '@playwright/test';
import {test as base,expect} from '@playwright/test';
import {pool} from '../../src/server/db.ts';
import {closeAIDatabase} from '../../src/server/ai-db.ts';
export const test=base.extend<{}, {databaseLifetime:void}>({databaseLifetime:[async({},use)=>{
 await use();await closeAIDatabase();if(!pool.ended)await pool.end();
},{scope:'worker',auto:true}]});
export {expect};

export async function submitRegistration(page:Page){
 for(let attempt=0;attempt<2;attempt++){
  const response=page.waitForResponse(r=>r.url().includes('/api/auth/sign-up/email')&&r.request().method()==='POST');await page.getByRole('button',{name:'创建账户'}).click();const result=await response;
  if(result.status()!==429)break;if(attempt===1)break;
  const retry=Number(result.headers()['retry-after']||60),delay=(Math.min(60,Math.max(1,Number.isFinite(retry)?retry:60))+1)*1000;
  for(let remaining=delay;remaining>0;remaining-=30000)await new Promise(resolve=>setTimeout(resolve,Math.min(30000,remaining)));
 }
 await expect(page.getByRole('status')).toContainText('注册请求已受理');
}
