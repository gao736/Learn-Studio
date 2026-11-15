import test from 'node:test';
import assert from 'node:assert/strict';
test('development reload never reuses an ended connection pool',async()=>{
 const first=(await import(new URL('../src/server/db.ts?lifecycle=first',import.meta.url).href)).pool;
 await first.end();
 const second=(await import(new URL('../src/server/db.ts?lifecycle=second',import.meta.url).href)).pool;
 try{assert.notEqual(second,first);assert.equal(second.ended,false);}finally{if(!second.ended)await second.end();}
});
