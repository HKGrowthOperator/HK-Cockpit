// lib/secrets.ts — kleine Tabelle für App-Geheimnisse (z. B. Google-OAuth-Tokens).
// Bewusst getrennt von module_items, damit Tokens NIE in den Assistenten-Kontext geraten.
import { pool } from "./db";

let ready: Promise<void> | null = null;

async function ensure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_secrets (
      key        text PRIMARY KEY,
      value      jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}
function init(): Promise<void> {
  if (!ready) ready = ensure();
  return ready;
}

export async function getSecret<T = unknown>(key: string): Promise<T | null> {
  await init();
  const { rows } = await pool.query<{ value: T }>("SELECT value FROM app_secrets WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSecret(key: string, value: unknown): Promise<void> {
  await init();
  await pool.query(
    "INSERT INTO app_secrets (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
    [key, JSON.stringify(value)],
  );
}

export async function delSecret(key: string): Promise<void> {
  await init();
  await pool.query("DELETE FROM app_secrets WHERE key = $1", [key]);
}
