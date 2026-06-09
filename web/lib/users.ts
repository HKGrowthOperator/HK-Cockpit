import bcrypt from "bcryptjs";
import { q } from "./db";

type UserRow = { email: string; password_hash: string };

// Prüft E-Mail + Passwort gegen die users-Tabelle. Gibt den Benutzer zurück oder null.
export async function verifyCredentials(email: string, password: string) {
  const rows = await q<UserRow>(
    "SELECT email, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [email],
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? { email: user.email } : null;
}
