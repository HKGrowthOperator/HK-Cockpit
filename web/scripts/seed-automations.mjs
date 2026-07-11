// Seedet die 31 HK-Automationen in die Cockpit-DB (Modul "automations").
// Umgeht den "nur wenn leer"-Seeder der App: leert das Modul und schreibt neu.
// Quelle: lib/data/automations.json  (dieselbe Datei nutzt auch die App)
// Nutzung (aus web/):  node scripts/seed-automations.mjs
// Liest DATABASE_URL selbstständig aus .env.local — kein Zugangsdaten-Handling nötig.
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

// DATABASE_URL: aus Umgebung, sonst aus .env.local parsen.
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(resolve(webRoot, ".env.local"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  } catch {}
  return null;
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.error("✗ Keine DATABASE_URL gefunden (Umgebung oder .env.local).");
  process.exit(1);
}

const automations = JSON.parse(
  readFileSync(resolve(webRoot, "lib/data/automations.json"), "utf8"),
);

const pool = new Pool({ connectionString, max: 3 });

try {
  // Tabelle sicherstellen (falls DB noch frisch ist).
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

  const before = await pool.query(
    "SELECT count(*)::int AS n FROM module_items WHERE module = 'automations'",
  );

  await pool.query("BEGIN");
  await pool.query("DELETE FROM module_items WHERE module = 'automations'");
  let pos = 0;
  for (const a of automations) {
    await pool.query(
      "INSERT INTO module_items (module, data, position) VALUES ('automations', $1, $2)",
      [JSON.stringify(a), pos++],
    );
  }
  await pool.query("COMMIT");

  const after = await pool.query(
    "SELECT count(*)::int AS n FROM module_items WHERE module = 'automations'",
  );
  console.log(`✓ Automationen geseedet: ${before.rows[0].n} → ${after.rows[0].n} (Datei: ${automations.length}).`);
} catch (err) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error("✗ Seeding fehlgeschlagen:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
