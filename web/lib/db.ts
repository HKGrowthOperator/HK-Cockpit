import { Pool } from "pg";

// Eine geteilte Connection-Pool-Instanz (überlebt Hot-Reloads im Dev-Modus).
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://cockpit:change-me-strong-password@localhost:5432/cockpit",
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function q<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
