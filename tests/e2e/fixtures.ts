import {test as base,expect} from '@playwright/test';
import {pool} from '../../src/server/db.ts';
import {closeAIDatabase} from '../../src/server/ai-db.ts';
export const test=base.extend<{}, {databaseLifetime:void}>({databaseLifetime:[async({},use)=>{
 await use();await closeAIDatabase();if(!pool.ended)await pool.end();
},{scope:'worker',auto:true}]});
export {expect};
