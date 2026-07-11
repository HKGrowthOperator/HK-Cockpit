// lib/store.ts — generic Postgres-backed store for all editable modules.
// One table holds every module's records as JSONB, discriminated by `module`.
// The schema is created and seeded on demand, so it works against an existing
// database without any manual migration step.
import { pool } from "./db";
import { MODULE_KEYS, SEEDS, MODULES } from "./modules";
import type { CardModel } from "./data/types";

export type Item = { id: string; data: Record<string, unknown> };
export type LoadedItem = { id: string; card: CardModel; values: Record<string, unknown> };

let ready: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS module_items (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      module     text NOT NULL,
      data       jsonb NOT NULL,
      position   double precision NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS module_items_module_idx ON module_items (module);
  `);
  // Seed any module whose table slice is still empty (first run only).
  for (const key of MODULE_KEYS) {
    const { rows } = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM module_items WHERE module = $1",
      [key],
    );
    if (rows[0]?.n !== "0") continue;
    let pos = 0;
    for (const data of SEEDS[key] ?? []) {
      await pool.query(
        "INSERT INTO module_items (module, data, position) VALUES ($1, $2, $3)",
        [key, JSON.stringify(data), pos++],
      );
    }
  }
}

function init(): Promise<void> {
  if (!ready) ready = ensureSchema();
  return ready;
}

export async function listItems(module: string): Promise<Item[]> {
  await init();
  const { rows } = await pool.query<{ id: string; data: Record<string, unknown> }>(
    "SELECT id, data FROM module_items WHERE module = $1 ORDER BY position ASC, created_at ASC",
    [module],
  );
  return rows.map((r) => ({ id: r.id, data: r.data }));
}

export async function createItem(module: string, data: Record<string, unknown>): Promise<void> {
  await init();
  const { rows } = await pool.query<{ m: number }>(
    "SELECT COALESCE(max(position), 0) + 1 AS m FROM module_items WHERE module = $1",
    [module],
  );
  await pool.query(
    "INSERT INTO module_items (module, data, position) VALUES ($1, $2, $3)",
    [module, JSON.stringify(data), rows[0]?.m ?? 0],
  );
}

export async function updateItem(id: string, data: Record<string, unknown>): Promise<void> {
  await init();
  await pool.query(
    "UPDATE module_items SET data = $2, updated_at = now() WHERE id = $1",
    [id, JSON.stringify(data)],
  );
}

export async function deleteItem(id: string): Promise<void> {
  await init();
  await pool.query("DELETE FROM module_items WHERE id = $1", [id]);
}

/** Load a module's records already mapped to the card UI + raw values (for editing). */
export async function loadModule(module: string): Promise<LoadedItem[]> {
  const items = await listItems(module);
  const def = MODULES[module];
  return items.map((it) => ({
    id: it.id,
    card: def.toCard({ id: it.id, data: it.data }),
    values: it.data,
  }));
}
