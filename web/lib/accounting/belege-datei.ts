// lib/accounting/belege-datei.ts — Ablage der Belegdateien auf der Platte.
// GoBD: Belege muessen unveraenderbar und wiederauffindbar aufbewahrt werden.
// Ablage nach Jahr/Monat, Dateiname enthaelt die Belegnummer.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { createHash } from "node:crypto";

/** Ablageort — im Container als Volume gemountet (siehe docker-compose).
 *  Erst zur Laufzeit auflösen, damit der Build den Pfad nicht einbäckt. */
export function belegVerzeichnis(): string {
  return process.env.BELEG_PFAD ?? "/data/belege";
}

const ERLAUBT = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/heic", "image/webp",
  "text/csv", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB je Beleg

export type Gespeichert = {
  pfad: string;
  name: string;
  mime: string;
  groesse: number;
  /** SHA-256 der Datei — belegt die Unveraendertheit und erkennt Duplikate. */
  hash: string;
};

export function pruefeDatei(name: string, mime: string, groesse: number): string | null {
  if (groesse <= 0) return "Datei ist leer.";
  if (groesse > MAX_BYTES) return `Datei ist zu groß (max. ${MAX_BYTES / 1024 / 1024} MB).`;
  if (!ERLAUBT.has(mime)) return `Dateityp ${mime || "unbekannt"} wird nicht angenommen (erlaubt: PDF, Bild, CSV, Excel).`;
  if (!name.trim()) return "Dateiname fehlt.";
  return null;
}

/** Entfernt Pfadanteile und gefaehrliche Zeichen aus dem Dateinamen. */
function sichererName(name: string): string {
  return basename(name).replace(/[^\w.\- ()äöüÄÖÜß]/g, "_").slice(0, 120);
}

export async function speichereDatei(
  belegnummer: string, dateiName: string, mime: string, daten: Buffer,
): Promise<Gespeichert> {
  const jahr = belegnummer.match(/(\d{4})/)?.[1] ?? String(new Date().getFullYear());
  const monat = String(new Date().getMonth() + 1).padStart(2, "0");
  const ordner = join(belegVerzeichnis(), jahr, monat);
  await mkdir(ordner, { recursive: true });

  const endung = extname(sichererName(dateiName)) || ".bin";
  const ziel = join(ordner, `${belegnummer}${endung}`);
  await writeFile(ziel, daten, { flag: "wx" }).catch(async (err: NodeJS.ErrnoException) => {
    // Existiert bereits (gleiche Belegnummer) → mit Zeitstempel danebenlegen.
    if (err.code !== "EEXIST") throw err;
    await writeFile(join(ordner, `${belegnummer}-${Date.now()}${endung}`), daten);
  });

  return {
    pfad: ziel,
    name: sichererName(dateiName),
    mime,
    groesse: daten.length,
    hash: createHash("sha256").update(daten).digest("hex"),
  };
}

export async function leseDatei(pfad: string): Promise<Buffer> {
  // Nur Dateien aus dem Belegverzeichnis herausgeben (kein Pfad-Ausbruch).
  if (!pfad.startsWith(belegVerzeichnis())) throw new Error("Ungültiger Pfad.");
  return readFile(pfad);
}

// ── Betrag und Datum aus Text ziehen ────────────────────────────────────────
// Fuer E-Mail-/Drive-Belege, bei denen Text mitgeliefert wird. Bewusst
// konservativ: lieber nichts vorschlagen als etwas Falsches.

export type Erkannt = { datum: string | null; brutto_cent: number | null; partner: string | null };

export function erkenneAusText(text: string): Erkannt {
  const t = (text || "").slice(0, 20000);

  // Datum: 31.07.2026 / 2026-07-31 / 31. Juli 2026
  let datum: string | null = null;
  const MONATE = ["januar", "februar", "märz", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
  const d1 = t.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  const d2 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const d3 = t.match(new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONATE.join("|")})\\s*(\\d{4})\\b`, "i"));
  if (d1) datum = `${d1[3]}-${d1[2]}-${d1[1]}`;
  else if (d2) datum = `${d2[1]}-${d2[2]}-${d2[3]}`;
  else if (d3) {
    const idx = MONATE.indexOf(d3[2].toLowerCase());
    const monat = String((idx === 3 ? 2 : idx > 3 ? idx : idx) + 1).padStart(2, "0");
    datum = `${d3[3]}-${monat}-${String(d3[1]).padStart(2, "0")}`;
  }

  // Betrag: bevorzugt die Zeile mit "Gesamt"/"Summe"/"Rechnungsbetrag".
  let brutto: number | null = null;
  const zeilen = t.split(/\r?\n/);
  const kandidaten = zeilen.filter((z) => /gesamt|summe|rechnungsbetrag|total|zu zahlen|endbetrag/i.test(z));
  const betragRe = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[,.](\d{2})\s*(?:€|eur)?/i;
  for (const z of [...kandidaten, ...zeilen]) {
    const m = z.match(betragRe);
    if (!m) continue;
    const ganz = m[1].replace(/[.\s]/g, "");
    const wert = Number(`${ganz}.${m[2]}`);
    if (Number.isFinite(wert) && wert > 0) { brutto = Math.round(wert * 100); break; }
  }

  // Partner: erste Zeile, die wie ein Firmenname aussieht.
  let partner: string | null = null;
  for (const z of zeilen.slice(0, 15)) {
    const s = z.trim();
    if (s.length < 3 || s.length > 80) continue;
    if (/rechnung|invoice|datum|seite|betrag|kunde/i.test(s)) continue;
    if (/[A-ZÄÖÜ]/.test(s[0])) { partner = s; break; }
  }

  return { datum, brutto_cent: brutto, partner };
}
