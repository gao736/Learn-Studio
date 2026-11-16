import test from 'node:test';
import assert from 'node:assert/strict';
process.loadEnvFile('.env.local');
const {pool}=await import('../src/server/db.ts');
test('hosted auth uses the assigned HTTPS URL and keeps explicit local configuration authoritative',async t=>{
 const load=async(label:string)=>{const module:typeof import('../src/server/auth.ts')=await import(`../src/server/auth.ts?${label}`);await module.auth.$context;return module;};
 const previous={url:process.env.BETTER_AUTH_URL,render:process.env.RENDER_EXTERNAL_URL,mail:process.env.LOCAL_MAILBOX};
 t.after(async()=>{for(const [key,value] of Object.entries({BETTER_AUTH_URL:previous.url,RENDER_EXTERNAL_URL:previous.render,LOCAL_MAILBOX:previous.mail})){if(value===undefined)delete process.env[key];else process.env[key]=value;}await pool.end();});
 process.env.LOCAL_MAILBOX='false';delete process.env.BETTER_AUTH_URL;process.env.RENDER_EXTERNAL_URL='https://learning-studio-fixture.onrender.com';
 const hosted=await load('hosted-origin-test');assert.equal(hosted.auth.options.baseURL,'https://learning-studio-fixture.onrender.com');
 process.env.BETTER_AUTH_URL='http://127.0.0.1:3000';const explicit=await load('explicit-origin-test');assert.equal(explicit.auth.options.baseURL,'http://127.0.0.1:3000');
 delete process.env.BETTER_AUTH_URL;delete process.env.RENDER_EXTERNAL_URL;const local=await load('default-origin-test');assert.equal(local.auth.options.baseURL,'http://127.0.0.1:3000');
});
