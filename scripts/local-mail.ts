import { SMTPServer } from 'smtp-server';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {isTestEmail} from '../src/features/auth/domain.ts';

if (process.env.LOCAL_MAILBOX !== 'true' || process.env.SMTP_HOST !== '127.0.0.1') {
  throw new Error('本机收件箱只允许显式开启并使用 127.0.0.1。');
}
const directory = path.resolve('.runtime/mail');
await mkdir(directory, { recursive: true });
const server = new SMTPServer({
  authOptional: true, disabledCommands: ['AUTH', 'STARTTLS'], size: 1024 * 1024,
  onRcptTo(address, _session, callback) {
    callback(isTestEmail(address.address) ? undefined : new Error('本机仅接收 example.test 测试地址'));
  },
  onData(stream, session, callback) {
    const chunks: Buffer[] = [];
    let length = 0;
    stream.on('data', (chunk: Buffer) => { length += chunk.length; if (length <= 1024 * 1024) chunks.push(chunk); });
    stream.on('error', callback);
    stream.on('end', async () => {
      if (length > 1024 * 1024) return callback(new Error('测试邮件过大'));
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const split = raw.indexOf('\r\n\r\n');
        const headers = raw.slice(0, split);
        const body = raw.slice(split + 4);
        // ponytail: this local sink handles the text-only base64 messages our mailer emits.
        const text = /Content-Transfer-Encoding: base64/i.test(headers) ? Buffer.from(body, 'base64').toString('utf8') : body;
        await writeFile(path.join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({
          to: session.envelope.rcptTo.map(address => address.address), text, receivedAt: new Date().toISOString(),
        }), { mode: 0o600 });
        console.log('已接收一封本机测试邮件，存入 .runtime/mail；未向互联网发送。');
        callback();
      } catch { callback(new Error('本机邮件保存失败')); }
    });
  },
});
server.on('error', () => { console.error('本机 SMTP 无法启动，请检查端口 1025。'); process.exitCode = 1; });
server.listen(1025, '127.0.0.1', () => console.log('本机测试 SMTP：127.0.0.1:1025；收件文件在 .runtime/mail。'));
