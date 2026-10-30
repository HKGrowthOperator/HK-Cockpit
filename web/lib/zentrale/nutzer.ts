// lib/zentrale/nutzer.ts — wer ist angemeldet, und was darf er?
//
// Zwei Rollen: „gf“ (Geschäftsführung) und „team“. Das Team arbeitet mit allem
// und gibt einzelne Mails frei. Nur die Geschäftsführung schaltet Dinge, die
// ohne Menschen pro Vorgang laufen: automatischer Versand, Vorlagen-Freigabe,
// Postfächer, Verbindungen und Geheimnisse.
import "server-only";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { q } from "@/lib/db";
import { zentraleBereit } from "./schema";

export type Nutzer = { email: string; name: string; rolle: "gf" | "team" };

export async function aktuellerNutzer(): Promise<Nutzer | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session?.email) return null;
  await zentraleBereit();
  const rows = await q<{ email: string; name: string | null; rolle: string }>(
    "SELECT email, name, rolle FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [session.email],
  );
  const u = rows[0];
  if (!u) return null; // Konto gelöscht → Sitzung zählt nicht mehr
  return { email: u.email, name: u.name || vornameAusMail(u.email), rolle: u.rolle === "team" ? "team" : "gf" };
}

export async function nutzerPflicht(): Promise<Nutzer> {
  const n = await aktuellerNutzer();
  if (!n) throw new Error("Nicht angemeldet.");
  return n;
}

export async function gfPflicht(): Promise<Nutzer> {
  const n = await nutzerPflicht();
  if (n.rolle !== "gf") throw new Error("Das darf nur die Geschäftsführung.");
  return n;
}

export function vornameAusMail(email: string): string {
  const teil = email.split("@")[0].split(/[._-]/)[0] ?? "";
  return teil.charAt(0).toUpperCase() + teil.slice(1);
}
