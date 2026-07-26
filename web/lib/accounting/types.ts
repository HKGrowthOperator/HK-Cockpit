// lib/accounting/types.ts — Datentypen der doppelten Buchführung.
// Grundsatz: Jede Buchung hat genau ein Soll- und ein Habenkonto (einfacher
// Buchungssatz) und einen Betrag > 0. Steuer wird aus dem Steuerschlüssel
// abgeleitet und als eigener Betrag mitgeführt (Vorsteuer/Umsatzsteuer).

/** Kontenrahmen: SKR03 (prozessgliedernd) oder SKR04 (abschlussgliedernd). */
export type Kontenrahmen = "SKR03" | "SKR04";

/** Kontoart bestimmt, wie das Konto in GuV/Bilanz einfliesst. */
export type Kontoart =
  | "aktiv" // Vermoegen (Bank, Kasse, Forderungen, Anlagen)
  | "passiv" // Kapital/Schulden (Verbindlichkeiten, Eigenkapital)
  | "ertrag" // Erloese
  | "aufwand"; // Kosten

/** Steuerschluessel — deckt die in der Praxis relevanten Faelle ab. */
export type Steuerschluessel =
  | "0" // ohne Umsatzsteuer (z. B. Geldtransit, Privatentnahme)
  | "19" // 19 % Umsatzsteuer / Vorsteuer
  | "7" // 7 % ermaessigt
  | "igE" // innergemeinschaftlicher Erwerb (Reverse Charge, EU)
  | "13b"; // Steuerschuldnerschaft des Leistungsempfaengers (§ 13b UStG)

export const STEUERSATZ: Record<Steuerschluessel, number> = {
  "0": 0,
  "19": 0.19,
  "7": 0.07,
  igE: 0.19,
  "13b": 0.19,
};

export const STEUER_LABEL: Record<Steuerschluessel, string> = {
  "0": "ohne USt",
  "19": "19 % USt",
  "7": "7 % USt",
  igE: "EU-Erwerb (Reverse Charge)",
  "13b": "§ 13b (Leistungsempfänger)",
};

export type Konto = {
  /** Kontonummer, z. B. "1200" (Bank) oder "8400" (Erloese 19 %). */
  nummer: string;
  bezeichnung: string;
  art: Kontoart;
  /** Voreingestellter Steuerschluessel beim Buchen auf dieses Konto. */
  steuer?: Steuerschluessel;
  /** Gruppe fuer Auswertungen, z. B. "Erlöse", "Raumkosten". */
  gruppe: string;
  /** true = Sachkonto steht in der GuV, false = Bilanzkonto. */
  guv: boolean;
};

export type BuchungStatus = "entwurf" | "gebucht" | "storniert";

export type Buchung = {
  id: string;
  /** Fortlaufende Nummer je Geschaeftsjahr, z. B. "2026-00042". */
  buchungsnummer: string;
  datum: string; // YYYY-MM-DD (Leistungs-/Belegdatum)
  buchungstext: string;
  /** Bruttobetrag in Cent — Ganzzahl, keine Rundungsfehler. */
  betrag_cent: number;
  /** Enthaltene Steuer in Cent (aus Steuerschluessel berechnet). */
  steuer_cent: number;
  steuerschluessel: Steuerschluessel;
  soll_konto: string;
  haben_konto: string;
  /** Verknuepfter Beleg (Rechnung, Quittung, Kontoauszug). */
  beleg_id?: string | null;
  /** Verknuepfte Ausgangsrechnung aus dem Rechnungen-Modul. */
  rechnung_id?: string | null;
  /** Verknuepfter Bankumsatz (bei Zahlungsabgleich). */
  bank_umsatz_id?: string | null;
  status: BuchungStatus;
  /** Bei Storno: id der stornierten Buchung. */
  storniert_buchung_id?: string | null;
  geschaeftsjahr: number;
  erstellt_am: string;
  erstellt_von?: string | null;
};

export type BelegTyp = "eingangsrechnung" | "ausgangsrechnung" | "quittung" | "kontoauszug" | "sonstiges";
export type BelegQuelle = "upload" | "email" | "drive" | "bank" | "manuell";
export type BelegStatus = "offen" | "gebucht" | "verworfen";

export type Beleg = {
  id: string;
  /** Fortlaufende Belegnummer, z. B. "B-2026-0007". */
  belegnummer: string;
  typ: BelegTyp;
  quelle: BelegQuelle;
  status: BelegStatus;
  datum: string | null; // YYYY-MM-DD
  betrag_cent: number | null;
  steuer_cent: number | null;
  waehrung: string;
  partner: string | null; // Lieferant oder Kunde
  beschreibung: string | null;
  /** Dateiname und gespeicherte Datei (Pfad im Beleg-Volume). */
  datei_name: string | null;
  datei_pfad: string | null;
  mime_typ: string | null;
  /** Rohdaten der Quelle (E-Mail-Header, Drive-Metadaten …). */
  quelle_meta: Record<string, unknown> | null;
  erstellt_am: string;
};

export type BankUmsatzStatus = "offen" | "zugeordnet" | "ignoriert";

export type BankUmsatz = {
  id: string;
  datum: string; // Buchungstag YYYY-MM-DD
  valuta: string | null;
  /** Positiv = Eingang, negativ = Ausgang. In Cent. */
  betrag_cent: number;
  waehrung: string;
  partner: string | null;
  verwendungszweck: string | null;
  iban: string | null;
  /** Eindeutiger Schluessel gegen Doppelimport (Hash aus Datum+Betrag+Zweck). */
  dedup_key: string;
  status: BankUmsatzStatus;
  /** Zugeordnete Rechnung/Buchung nach dem Abgleich. */
  rechnung_id: string | null;
  buchung_id: string | null;
  erstellt_am: string;
};

/** Ein Saldo je Konto fuer die Summen- und Saldenliste. */
export type KontoSaldo = {
  konto: string;
  bezeichnung: string;
  art: Kontoart;
  gruppe: string;
  soll_cent: number;
  haben_cent: number;
  /** Saldo im Sinne der Kontoart (aktiv/aufwand: Soll-Haben, sonst umgekehrt). */
  saldo_cent: number;
};
