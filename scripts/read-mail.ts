import { readdir, readFile } from 'node:fs/promises';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/@example\.test$/.test(email)) throw new Error('用法：node scripts/read-mail.ts yourname@example.test');
const files = (await readdir('.runtime/mail')).sort().reverse();
for (const file of files) {
  const mail = JSON.parse(await readFile(`.runtime/mail/${file}`, 'utf8'));
  if (mail.to.includes(email)) { console.log(mail.text); process.exit(0); }
}
console.log('尚未收到此测试邮箱的邮件。');
