import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedAuthRequest } from '../src/features/auth/input.ts';

test('rejects oversized authentication requests before they reach the auth library', async () => {
  const request = new Request('http://127.0.0.1:3000/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(20000) }) });
  const result = await boundedAuthRequest(request);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 413);
});
test('validates the display name on the server even when browser validation is bypassed', async () => {
  const invalid = await boundedAuthRequest(new Request('http://127.0.0.1:3000/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(81) }) }));
  assert.ok(invalid instanceof Response);
  assert.equal(invalid.status, 400);
  const valid = await boundedAuthRequest(new Request('http://127.0.0.1:3000/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name: '学习者', email: 'local@example.test' }) }));
  assert.ok(valid instanceof Request);
  assert.equal((await valid.json()).name, '学习者');
});

test('local mailbox rejects unsupported recipients before account creation or mail requests without restricting real SMTP mode',async()=>{
  const previous=process.env.LOCAL_MAILBOX;
  const request=(route:string,email:string)=>new Request(`http://127.0.0.1:3000/api/auth/${route}`,{method:'POST',body:JSON.stringify({name:'本机验收',email})});
  try{
    process.env.LOCAL_MAILBOX='true';
    for(const route of ['sign-up/email','send-verification-email','request-password-reset']){
      const rejected=await boundedAuthRequest(request(route,'learner@qq.com'));
      assert.ok(rejected instanceof Response);assert.equal(rejected.status,400);assert.equal((await rejected.json()).code,'LOCAL_TEST_EMAIL_REQUIRED');
      assert.ok(await boundedAuthRequest(request(route,'Learner@EXAMPLE.TEST')) instanceof Request);
    }
    assert.ok(await boundedAuthRequest(request('sign-in/email','learner@qq.com')) instanceof Request);
    process.env.LOCAL_MAILBOX='false';
    assert.ok(await boundedAuthRequest(request('sign-up/email','learner@qq.com')) instanceof Request);
  }finally{if(previous===undefined)delete process.env.LOCAL_MAILBOX;else process.env.LOCAL_MAILBOX=previous;}
});
