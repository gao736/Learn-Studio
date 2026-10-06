import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
process.loadEnvFile('.env.local');
const { pool, withUserDatabase } = await import('../src/server/db.ts');
const { saveAttempt, getAttempt } = await import('../src/features/lesson/repository.ts');

test('real PostgreSQL persists results, isolates users at the database layer, and deduplicates retries', async t => {
  const first = randomUUID(), second = randomUUID();
  t.after(async () => {
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[first, second]]);
    await pool.end();
  });
  for (const id of [first, second]) {
    await pool.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())', [id, '数据库验收账户', `${id}@example.test`]);
  }
  const key = randomUUID();
  const stored = await saveAttempt(first, key, { q1: '1', q2: '0', q3: '2', q4: '1', q5: '0' });
  assert.equal(stored.score, 5);
  const duplicate = await saveAttempt(first, key, { q1: '0', q2: '1', q3: '0', q4: '0', q5: '1' });
  assert.equal(duplicate.id, stored.id);
  assert.equal(duplicate.score, 5);
  assert.equal((await getAttempt(first, stored.id))?.score, 5);
  assert.equal(await getAttempt(second, stored.id), null);
  // Deliberately omit the owner WHERE clause: PostgreSQL's policy must still deny it.
  const foreignRows = await withUserDatabase(second, client => client.query('SELECT id FROM lesson_attempts WHERE id=$1', [stored.id]));
  assert.equal(foreignRows.rowCount, 0);
  const leakedContext = await pool.query('SELECT id FROM lesson_attempts WHERE id=$1', [stored.id]);
  assert.equal(leakedContext.rowCount, 0);
});
