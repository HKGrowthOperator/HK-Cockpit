// lib/accounting/buchen.ts — Buchungssaetze bilden, pruefen und speichern.
// Rechnen konsequent in Cent (Ganzzahlen), damit keine Rundungsfehler entstehen.

import { STANDARDKONTEN } from "./kontenrahmen";
import { STEUERSATZ, type Kontenrahmen, type Steuerschluessel, type Konto, type Buchung } from "./types";

// ── Betraege ────────────────────────────────────────────────────────────────

/** "1.234,56" oder "1234.56" → 123456 (Cent). */
export function toCent(v: string | number): number {
  if (typeof v === "number") return Math.round(v * 100);
  const s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  // Deutsches Format erkennen: letztes Komma ist das Dezimaltrennzeichen.
  const deutsch = /,\d{1,2}$/.test(s);
  const norm = deutsch ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatCent(cent: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
    .format(cent / 100);
}

/** Steueranteil aus einem BRUTTObetrag: 119 € bei 19 % → 19 € Steuer. */
export function steuerAusBrutto(bruttoCent: number, schluessel: Steuerschluessel): number {
  const satz = STEUERSATZ[schluessel];
  if (!satz) return 0;
  // Bei Reverse Charge (13b/igE) schuldet der Empfaenger die Steuer; der
  // Rechnungsbetrag ist netto, die Steuer wird zusaetzlich ausgewiesen.
  if (schluessel === "13b" || schluessel === "igE") return Math.round(bruttoCent * satz);
  return Math.round((bruttoCent * satz) / (1 + satz));
}

export function nettoAusBrutto(bruttoCent: number, schluessel: Steuerschluessel): number {
  if (schluessel === "13b" || schluessel === "igE") return bruttoCent;
  return bruttoCent - steuerAusBrutto(bruttoCent, schluessel);
}

// ── Validierung ─────────────────────────────────────────────────────────────

export type BuchungEingabe = {
  datum: string;
  buchungstext: string;
  betrag: string | number; // brutto
  steuerschluessel: Steuerschluessel;
  soll_konto: string;
  haben_konto: string;
  beleg_id?: string | null;
  rechnung_id?: string | null;
  bank_umsatz_id?: string | null;
  erstellt_von?: string | null;
};

export type PruefErgebnis = { ok: true } | { ok: false; fehler: string[] };

export function pruefeBuchung(e: BuchungEingabe, konten: Map<string, Konto>): PruefErgebnis {
  const fehler: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) fehler.push("Datum fehlt oder hat nicht das Format JJJJ-MM-TT.");
  if (!e.buchungstext?.trim()) fehler.push("Buchungstext fehlt.");
  const cent = toCent(e.betrag);
  if (cent <= 0) fehler.push("Betrag muss größer als 0 sein.");
  if (!e.soll_konto) fehler.push("Sollkonto fehlt.");
  if (!e.haben_konto) fehler.push("Habenkonto fehlt.");
  if (e.soll_konto && e.haben_konto && e.soll_konto === e.haben_konto)
    fehler.push("Soll- und Habenkonto dürfen nicht identisch sein.");
  if (e.soll_konto && !konten.has(e.soll_konto)) fehler.push(`Sollkonto ${e.soll_konto} ist unbekannt.`);
  if (e.haben_konto && !konten.has(e.haben_konto)) fehler.push(`Habenkonto ${e.haben_konto} ist unbekannt.`);
  // Zukunftsdatum ist zulaessig (Dauerbuchungen), aber nicht mehr als ein Jahr.
  if (/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) {
    const d = new Date(e.datum).getTime();
    if (d > Date.now() + 365 * 864e5) fehler.push("Datum liegt zu weit in der Zukunft.");
  }
  return fehler.length ? { ok: false, fehler } : { ok: true };
}

// ── Schnellbuchungen (haeufige Geschaeftsvorfaelle) ─────────────────────────
// Diese Helfer bilden den korrekten Buchungssatz, damit der Nutzer nicht
// wissen muss, was auf Soll und was auf Haben gehoert.

export type Schnellvorgang =
  | "ausgangsrechnung" // Leistung an Kunde berechnet
  | "zahlungseingang" // Kunde zahlt Rechnung
  | "eingangsrechnung" // Lieferantenrechnung erhalten
  | "zahlungsausgang" // Lieferant bezahlt
  | "barausgabe" // direkt per Karte/Bank bezahlte Ausgabe
  | "bareinnahme"; // direkt vereinnahmt

export const SCHNELLVORGANG_LABEL: Record<Schnellvorgang, string> = {
  ausgangsrechnung: "Ausgangsrechnung (Kunde berechnet)",
  zahlungseingang: "Zahlungseingang (Kunde zahlt)",
  eingangsrechnung: "Eingangsrechnung (Lieferant)",
  zahlungsausgang: "Zahlungsausgang (Lieferant bezahlt)",
  barausgabe: "Ausgabe direkt bezahlt",
  bareinnahme: "Einnahme direkt erhalten",
};

/** Liefert Soll-/Habenkonto fuer einen Vorgang. `gegenkonto` ist das
 *  Erloes- bzw. Aufwandskonto (bei Zahlungen das Geldkonto). */
export function kontierung(
  vorgang: Schnellvorgang,
  rahmen: Kontenrahmen,
  gegenkonto: string,
  geldkonto?: string,
): { soll: string; haben: string } {
  const s = STANDARDKONTEN[rahmen];
  const geld = geldkonto || s.bank;
  switch (vorgang) {
    // Forderung entsteht, Erloes wird realisiert.
    case "ausgangsrechnung":
      return { soll: s.forderungen, haben: gegenkonto };
    // Geld kommt an, Forderung geht weg.
    case "zahlungseingang":
      return { soll: geld, haben: s.forderungen };
    // Aufwand entsteht, Verbindlichkeit gegenueber Lieferant.
    case "eingangsrechnung":
      return { soll: gegenkonto, haben: s.verbindlichkeiten };
    // Verbindlichkeit wird getilgt, Geld geht raus.
    case "zahlungsausgang":
      return { soll: s.verbindlichkeiten, haben: geld };
    // Aufwand direkt vom Konto bezahlt (keine Verbindlichkeit dazwischen).
    case "barausgabe":
      return { soll: gegenkonto, haben: geld };
    // Einnahme direkt aufs Konto (keine Forderung dazwischen).
    case "bareinnahme":
      return { soll: geld, haben: gegenkonto };
  }
}

/** Der Steuerschluessel ergibt sich aus dem bebuchten Erloes-/Aufwandskonto. */
export function steuerFuerKonto(konto: Konto | undefined): Steuerschluessel {
  return konto?.steuer ?? "0";
}
