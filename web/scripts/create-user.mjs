// Legt einen Login-Benutzer an (oder setzt sein Passwort neu).
// Nutzung:  DATABASE_URL=... node scripts/create-user.mjs <email> <passwort> [--name "Vorname"] [--rolle gf|team]
// Das Passwort wird sofort gehasht und NUR als Hash gespeichert.
// Rollen: gf = Geschäftsführung (alles), team = arbeitet mit allem, schaltet aber
// keine Automatik, Postfächer oder Verbindungen.
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const wert = args[i + 1];
  args.splice(i, 2);
  return wert;
};
const name = opt("name");
const rolle = opt("rolle");
const [email, password] = args;
if (!email || !password || (rolle && !["gf", "team"].includes(rolle))) {
  console.error('Nutzung: node scripts/create-user.mjs <email> <passwort> [--name "Vorname"] [--rolle gf|team]');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name text");
await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS rolle text NOT NULL DEFAULT 'gf'");
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO users (email, password_hash, name, rolle) VALUES ($1, $2, $3, COALESCE($4, 'team'))
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
          name = COALESCE($3, users.name), rolle = COALESCE($4, users.rolle)`,
  [email.toLowerCase(), hash, name ?? null, rolle ?? null],
);
console.log(`✓ Benutzer ${email} angelegt/aktualisiert${rolle ? ` (Rolle ${rolle})` : ""}.`);
await pool.end();
