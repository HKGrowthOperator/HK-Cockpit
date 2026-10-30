// lib/zentrale/krypto.ts — Verschlüsselung für gespeicherte Geheimnisse
// (SMTP-Passwörter, Ereignis-Geheimnisse) und HMAC-Prüfung eingehender Ereignisse.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";

function schluessel(): Buffer {
  const quelle = process.env.ZENTRALE_SECRET_KEY || process.env.AUTH_SECRET;
  if (!quelle) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ZENTRALE_SECRET_KEY (oder AUTH_SECRET) fehlt — Geheimnisse können nicht verschlüsselt werden.");
    }
    return Buffer.from(hkdfSync("sha256", "dev-only-zentrale", "hk-zentrale", "geheimnisse-v1", 32));
  }
  return Buffer.from(hkdfSync("sha256", quelle, "hk-zentrale", "geheimnisse-v1", 32));
}

/** AES-256-GCM. Ausgabe: "v1:" + base64(iv | tag | chiffrat). */
export function verschluesseln(klartext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", schluessel(), iv);
  const ct = Buffer.concat([c.update(klartext, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function entschluesseln(wert: string): string {
  if (!wert.startsWith("v1:")) throw new Error("Unbekanntes Format");
  const roh = Buffer.from(wert.slice(3), "base64");
  const d = createDecipheriv("aes-256-gcm", schluessel(), roh.subarray(0, 12));
  d.setAuthTag(roh.subarray(12, 28));
  return Buffer.concat([d.update(roh.subarray(28)), d.final()]).toString("utf8");
}

/** Signatur im Format der HK-Apps: "sha256=" + HMAC-SHA256(body) als Hex. */
export function signieren(body: string, geheimnis: string): string {
  return "sha256=" + createHmac("sha256", geheimnis).update(body).digest("hex");
}

/** Zeitkonstanter Vergleich der mitgeschickten Signatur. */
export function signaturGueltig(body: string, geheimnis: string, kopf: string | null): boolean {
  if (!kopf || !geheimnis) return false;
  const erwartet = Buffer.from(signieren(body, geheimnis));
  const erhalten = Buffer.from(kopf.trim());
  return erwartet.length === erhalten.length && timingSafeEqual(erwartet, erhalten);
}

export function neuesGeheimnis(): string {
  return randomBytes(32).toString("hex");
}

export function hash(...teile: string[]): string {
  const h = createHash("sha256");
  for (const t of teile) h.update(t).update("\u0000");
  return h.digest("hex");
}
