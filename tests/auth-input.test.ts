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
