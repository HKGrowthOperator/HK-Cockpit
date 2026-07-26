// lib/accounting/datev.ts — Export im DATEV-Format EXTF (Buchungsstapel).
// Damit kann der Steuerberater die Buchungen direkt einlesen. Aufbau nach
// DATEV-Formatbeschreibung "Buchungsstapel" Version 700.

import type { Buchung, Kontenrahmen } from "./types";

const KOPFZEILE = [
  "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs",
  "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext",
];

/** DATEV-Umsatz: Komma als Dezimaltrennzeichen, kein Tausenderpunkt. */
function betrag(cent: number): string {
  return (Math.abs(cent) / 100).toFixed(2).replace(".", ",");
}

/** Belegdatum im DATEV-Format TTMM. */
function datumTTMM(iso: string): string {
  return iso.slice(8, 10) + iso.slice(5, 7);
}

function feld(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // Anfuehrungszeichen verdoppeln, Semikolon/Zeilenumbruch entschaerfen.
  return `"${s.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

/** BU-Schluessel (Steuerschluessel) in DATEV-Notation. */
function buSchluessel(s: Buchung["steuerschluessel"]): string {
  switch (s) {
    case "19": return "9";
    case "7": return "2";
    case "igE": return "91";
    case "13b": return "94";
    default: return "";
  }
}

export type DatevOptions = {
  beraterNr?: number;
  mandantenNr?: number;
  firma: string;
  jahr: number;
  rahmen: Kontenrahmen;
  /** Laenge der Sachkontonummern (4 = Standard bei SKR03/04). */
  sachkontenlaenge?: number;
};

/** Erzeugt den kompletten EXTF-Buchungsstapel als CSV-Text (Windows-1252-tauglich). */
export function datevExport(buchungen: Buchung[], o: DatevOptions): string {
  const heute = new Date();
  const stamp =
    heute.getFullYear().toString() +
    String(heute.getMonth() + 1).padStart(2, "0") +
    String(heute.getDate()).padStart(2, "0") +
    String(heute.getHours()).padStart(2, "0") +
    String(heute.getMinutes()).padStart(2, "0") +
    String(heute.getSeconds()).padStart(2, "0") + "000";

  const wjBeginn = `${o.jahr}0101`;
  const von = `${o.jahr}0101`;
  const bis = `${o.jahr}1231`;

  // Header-Zeile 1: Kennung und Metadaten des Stapels.
  const header = [
    feld("EXTF"), 700, 21, feld("Buchungsstapel"), 13, stamp, "", feld("HK Cockpit"),
    feld(o.firma), o.beraterNr ?? 0, o.mandantenNr ?? 0, wjBeginn,
    o.sachkontenlaenge ?? 4, von, bis, feld(`Buchungen ${o.jahr}`), feld(""),
    1, 0, feld("EUR"), "", "", "", "", "", "", "", "", "", "", "", "",
  ].join(";");

  const spalten = KOPFZEILE.map(feld).join(";");

  const zeilen = buchungen
    .filter((b) => b.status === "gebucht")
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.buchungsnummer.localeCompare(b.buchungsnummer))
    .map((b) =>
      [
        betrag(b.betrag_cent), // Umsatz immer positiv
        feld("S"), // Soll-Kennzeichen; Richtung steckt in Konto/Gegenkonto
        feld("EUR"), "", "", "",
        feld(b.soll_konto), // Konto = Sollkonto
        feld(b.haben_konto), // Gegenkonto = Habenkonto
        feld(buSchluessel(b.steuerschluessel)),
        datumTTMM(b.datum),
        feld(b.buchungsnummer),
        feld(""),
        "",
        feld(b.buchungstext.slice(0, 60)), // DATEV: max. 60 Zeichen
      ].join(";"),
    );

  return [header, spalten, ...zeilen].join("\r\n") + "\r\n";
}

/** Einfacher CSV-Export (Excel/LibreOffice) als Alternative zum DATEV-Format. */
export function csvExport(buchungen: Buchung[]): string {
  const kopf = [
    "Buchungsnummer", "Datum", "Buchungstext", "Betrag brutto", "Steuer",
    "Steuerschlüssel", "Sollkonto", "Habenkonto", "Status",
  ];
  const zeilen = buchungen.map((b) => [
    b.buchungsnummer, b.datum, b.buchungstext,
    betrag(b.betrag_cent), betrag(b.steuer_cent),
    b.steuerschluessel, b.soll_konto, b.haben_konto, b.status,
  ]);
  return [kopf, ...zeilen].map((r) => r.map(feld).join(";")).join("\r\n") + "\r\n";
}
