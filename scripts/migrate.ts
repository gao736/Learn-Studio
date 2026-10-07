import { getMigrations } from 'better-auth/db/migration';
import { readFile } from 'node:fs/promises';
import { auth } from '../src/server/auth.ts';
import { pool } from '../src/server/db.ts';

try {
  const migrations = await getMigrations(auth.options);
  if (migrations.schemaProblems.length) throw new Error('认证表结构需要人工检查，拒绝不安全迁移。');
  await migrations.runMigrations();
  for (const file of ['001-lesson.sql','002-courses.sql','003-assessments.sql']) {
    await pool.query(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  console.log('认证、课堂与考核表迁移完成，数据隔离已启用。');
} finally { await pool.end(); }
