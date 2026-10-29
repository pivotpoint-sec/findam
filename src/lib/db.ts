import { Pool, type QueryResultRow } from "pg";

// One pool per server process. In development Next reloads modules often, so
// keep the pool on globalThis to avoid opening a new one on every change.
const globalForPool = globalThis as unknown as { findamPool?: Pool };

export const pool =
  globalForPool.findamPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPool.findamPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
