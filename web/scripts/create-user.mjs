// Legt einen Login-Benutzer an (oder setzt sein Passwort neu).
// Nutzung:  DATABASE_URL=... node scripts/create-user.mjs <email> <passwort>
// Das Passwort wird sofort gehasht und NUR als Hash gespeichert.
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Nutzung: node scripts/create-user.mjs <email> <passwort>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO users (email, password_hash) VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [email.toLowerCase(), hash],
);
console.log(`✓ Benutzer ${email} angelegt/aktualisiert.`);
await pool.end();
