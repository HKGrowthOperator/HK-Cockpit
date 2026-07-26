// lib/accounting/bank-csv.ts — Kontoauszuege aus dem Online-Banking einlesen
// und offenen Rechnungen zuordnen. Erkennt die verbreiteten deutschen
// CSV-Formate (Sparkasse/CAMT, Volksbank, DKB, N26, Commerzbank …) anhand
// der Spaltenueberschriften statt fester Spaltenpositionen.

import type { BankUmsatz } from "./types";
import { toCent } from "./buchen";

// ── CSV lesen (mit Anfuehrungszeichen und eingebetteten Trennzeichen) ───────

export function parseCSV(text: string): string[][] {
  // BOM entfernen, Trennzeichen automatisch bestimmen.
  const clean = text.replace(/^﻿/, "");
  const kopf = clean.split(/\r?\n/, 1)[0] ?? "";
  const trenner = (kopf.match(/;/g)?.length ?? 0) >= (kopf.match(/,/g)?.length ?? 0) ? ";" : ",";

  const zeilen: string[][] = [];
  let feld = "";
  let zeile: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { feld += '"'; i++; } // verdoppeltes Quote
        else inQuotes = false;
      } else feld += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === trenner) { zeile.push(feld); feld = ""; continue; }
    if (c === "\n") {
      zeile.push(feld); feld = "";
      if (zeile.some((f) => f.trim())) zeilen.push(zeile);
      zeile = [];
      continue;
    }
    if (c === "\r") continue;
    feld += c;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim())) zeilen.push(zeile);
  return zeilen;
}

// ── Spalten erkennen ────────────────────────────────────────────────────────

const SPALTEN = {
  datum: [/buchungstag/i, /^datum$/i, /booking\s?date/i, /wertstellung/i, /valuta/i],
  valuta: [/wertstellung/i, /valuta/i, /value\s?date/i],
  betrag: [/^betrag/i, /umsatz/i, /amount/i, /soll\s?\/\s?haben/i],
  partner: [/beg(ü|ue)nstigter/i, /zahlungspflichtiger/i, /auftraggeber/i, /empf(ä|ae)nger/i, /name/i, /payee/i, /partner/i],
  zweck: [/verwendungszweck/i, /buchungstext/i, /vorgang/i, /reference/i, /payment\s?reference/i, /beschreibung/i],
  iban: [/iban/i, /kontonummer/i, /account/i],
  waehrung: [/w(ä|ae)hrung/i, /currency/i],
};

function findeSpalte(kopf: string[], muster: RegExp[]): number {
  for (const m of muster) {
    const i = kopf.findIndex((h) => m.test(h.trim()));
    if (i >= 0) return i;
  }
  return -1;
}

/** Sucht die Kopfzeile — manche Banken schreiben Metadaten davor. */
function findeKopfzeile(zeilen: string[][]): number {
  for (let i = 0; i < Math.min(zeilen.length, 15); i++) {
    const z = zeilen[i];
    if (z.length < 3) continue;
    const hatDatum = findeSpalte(z, SPALTEN.datum) >= 0;
    const hatBetrag = findeSpalte(z, SPALTEN.betrag) >= 0;
    if (hatDatum && hatBetrag) return i;
  }
  return -1;
}

function normDatum(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/); // 31.07.2026
  if (m) {
    const jahr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${jahr}-${m[2]}-${m[1]}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // 2026-07-31
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export type ImportErgebnis = {
  umsaetze: Array<Omit<BankUmsatz, "id" | "status" | "rechnung_id" | "buchung_id" | "erstellt_am">>;
  uebersprungen: number;
  fehler: string[];
};

/** Wandelt einen CSV-Kontoauszug in Umsatz-Datensaetze um. */
export function parseBankCSV(text: string): ImportErgebnis {
  const fehler: string[] = [];
  const zeilen = parseCSV(text);
  if (!zeilen.length) return { umsaetze: [], uebersprungen: 0, fehler: ["Datei ist leer."] };

  const kopfIdx = findeKopfzeile(zeilen);
  if (kopfIdx < 0) {
    return {
      umsaetze: [], uebersprungen: 0,
      fehler: ["Kopfzeile nicht erkannt — es braucht Spalten für Datum und Betrag."],
    };
  }

  const kopf = zeilen[kopfIdx];
  const iDatum = findeSpalte(kopf, SPALTEN.datum);
  const iValuta = findeSpalte(kopf, SPALTEN.valuta);
  const iBetrag = findeSpalte(kopf, SPALTEN.betrag);
  const iPartner = findeSpalte(kopf, SPALTEN.partner);
  const iZweck = findeSpalte(kopf, SPALTEN.zweck);
  const iIban = findeSpalte(kopf, SPALTEN.iban);
  const iWaehrung = findeSpalte(kopf, SPALTEN.waehrung);

  const umsaetze: ImportErgebnis["umsaetze"] = [];
  let uebersprungen = 0;

  for (let i = kopfIdx + 1; i < zeilen.length; i++) {
    const z = zeilen[i];
    const datum = normDatum(z[iDatum] ?? "");
    const betragRoh = (z[iBetrag] ?? "").trim();
    if (!datum || !betragRoh) { uebersprungen++; continue; }

    let cent = toCent(betragRoh);
    // Manche Formate fuehren Soll/Haben in einer eigenen Spalte ("S"/"H").
    const shSpalte = kopf.findIndex((h) => /soll\s?\/\s?haben|s\/h/i.test(h));
    if (shSpalte >= 0 && /^S/i.test((z[shSpalte] ?? "").trim())) cent = -Math.abs(cent);
    if (cent === 0) { uebersprungen++; continue; }

    const partner = iPartner >= 0 ? (z[iPartner] ?? "").trim() : "";
    const zweck = iZweck >= 0 ? (z[iZweck] ?? "").trim() : "";

    umsaetze.push({
      datum,
      valuta: iValuta >= 0 ? normDatum(z[iValuta] ?? "") : null,
      betrag_cent: cent,
      waehrung: (iWaehrung >= 0 ? (z[iWaehrung] ?? "").trim() : "") || "EUR",
      partner: partner || null,
      verwendungszweck: zweck || null,
      iban: iIban >= 0 ? (z[iIban] ?? "").trim() || null : null,
      // Stabiler Schluessel gegen Doppelimport desselben Auszugs.
      dedup_key: dedupKey(datum, cent, partner, zweck),
    });
  }

  if (!umsaetze.length && !fehler.length) fehler.push("Keine verwertbaren Zeilen gefunden.");
  return { umsaetze, uebersprungen, fehler };
}

function dedupKey(datum: string, cent: number, partner: string, zweck: string): string {
  const roh = `${datum}|${cent}|${partner.toLowerCase()}|${zweck.toLowerCase().replace(/\s+/g, " ").trim()}`;
  // Kompakter, stabiler Hash (FNV-1a) — reicht zur Duplikaterkennung.
  let h = 0x811c9dc5;
  for (let i = 0; i < roh.length; i++) {
    h ^= roh.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${datum}-${Math.abs(cent)}-${h.toString(16)}`;
}

// ── Zahlungsabgleich gegen offene Rechnungen ───────────────────────────────

export type OffeneRechnung = {
  id: string;
  invoice_id: string;
  company: string;
  customer_name: string;
  amount_cent: number;
};

export type Treffer = {
  umsatz_id: string;
  rechnung: OffeneRechnung;
  /** 0–100: wie sicher die Zuordnung ist. */
  sicherheit: number;
  grund: string;
};

/** Ordnet Zahlungseingaenge offenen Rechnungen zu.
 *  Sicher: Rechnungsnummer im Verwendungszweck. Sonst: Betrag + Namensteil. */
export function ordneZu(umsaetze: BankUmsatz[], rechnungen: OffeneRechnung[]): Treffer[] {
  const treffer: Treffer[] = [];
  const vergeben = new Set<string>();

  for (const u of umsaetze) {
    if (u.betrag_cent <= 0 || u.status !== "offen") continue; // nur Eingaenge
    const text = `${u.verwendungszweck ?? ""} ${u.partner ?? ""}`.toLowerCase();

    // 1. Rechnungsnummer im Text — eindeutigster Fall.
    const perNummer = rechnungen.find((r) => {
      if (vergeben.has(r.id) || !r.invoice_id) return false;
      const nr = r.invoice_id.toLowerCase();
      const kompakt = nr.replace(/[^a-z0-9]/g, "");
      const textKompakt = text.replace(/[^a-z0-9]/g, "");
      return text.includes(nr) || (kompakt.length >= 6 && textKompakt.includes(kompakt));
    });
    if (perNummer) {
      const betragPasst = Math.abs(perNummer.amount_cent - u.betrag_cent) <= 100;
      vergeben.add(perNummer.id);
      treffer.push({
        umsatz_id: u.id,
        rechnung: perNummer,
        sicherheit: betragPasst ? 100 : 85,
        grund: betragPasst
          ? `Rechnungsnummer ${perNummer.invoice_id} und Betrag stimmen überein.`
          : `Rechnungsnummer ${perNummer.invoice_id} gefunden, Betrag weicht ab.`,
      });
      continue;
    }

    // 2. Exakter Betrag + Firmen-/Personenname im Text.
    const perBetrag = rechnungen.filter(
      (r) => !vergeben.has(r.id) && Math.abs(r.amount_cent - u.betrag_cent) <= 1,
    );
    const mitName = perBetrag.find((r) => {
      const worte = `${r.company} ${r.customer_name}`
        .toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
      return worte.some((w) => text.includes(w));
    });
    if (mitName) {
      vergeben.add(mitName.id);
      treffer.push({
        umsatz_id: u.id, rechnung: mitName, sicherheit: 90,
        grund: "Betrag und Name stimmen überein.",
      });
      continue;
    }
    // 3. Nur Betrag, und der ist eindeutig.
    if (perBetrag.length === 1) {
      vergeben.add(perBetrag[0].id);
      treffer.push({
        umsatz_id: u.id, rechnung: perBetrag[0], sicherheit: 65,
        grund: "Betrag stimmt genau — bitte kurz prüfen.",
      });
    }
  }
  return treffer;
}
