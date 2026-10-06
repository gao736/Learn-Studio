import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pool, withUserDatabase } from '../src/server/db.ts';

const mode = process.argv[2];
assert.ok(mode === 'snapshot' || mode === 'verify', '使用 snapshot 或 verify');
const databaseURL = new URL(process.env.DATABASE_URL!);
assert.equal(databaseURL.hostname, '127.0.0.1', '只检查本机数据库');
const baseline = new URL('../.runtime/restart-baseline.json', import.meta.url);
try {
  const users = await pool.query<{ id: string }>('SELECT id FROM "user" ORDER BY id');
  const rows = [];
  for (const user of users.rows) {
    const records = await withUserDatabase(user.id, client => client.query(
      'SELECT id, score, total, created_at FROM lesson_attempts ORDER BY id',
    ));
    rows.push(...records.rows);
  }
  assert.ok(rows.length > 0, '必须先保存至少一次真实答题');
  const snapshot = { count: rows.length, digest: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  if (mode === 'snapshot') await writeFile(baseline, JSON.stringify(snapshot));
  else assert.deepEqual(snapshot, JSON.parse(await readFile(baseline, 'utf8')));
  console.log(`${mode === 'snapshot' ? '已记录重启前指纹' : '重启后记录与指纹一致'}：${rows.length} 条答题记录。`);
} finally { await pool.end(); }
