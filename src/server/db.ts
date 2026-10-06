import { Pool } from 'pg';
import type { PoolClient } from 'pg';

const globalDb = globalThis as typeof globalThis & { learningPool?: Pool };
export const pool = globalDb.learningPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
});
if (process.env.NODE_ENV !== 'production') globalDb.learningPool = pool;

export async function withUserDatabase<T>(userId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
