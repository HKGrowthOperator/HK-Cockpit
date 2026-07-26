// lib/accounting/kontenrahmen.ts — SKR03 und SKR04 als praxisnaher Auszug.
// Bewusst nicht der vollstaendige Rahmen (mehrere tausend Konten), sondern die
// Konten, die eine Digital-Agentur tatsaechlich bebucht. Eigene Konten koennen
// jederzeit in der Datenbank ergaenzt werden (Tabelle konten), ohne Code-Aenderung.

import type { Konto, Kontenrahmen } from "./types";

// ── SKR03 (prozessgliedernd — verbreitet bei kleineren Unternehmen) ─────────
export const SKR03: Konto[] = [
  // Bestandskonten — Aktiva
  { nummer: "0400", bezeichnung: "Betriebsausstattung", art: "aktiv", gruppe: "Anlagevermögen", guv: false },
  { nummer: "0480", bezeichnung: "Geringwertige Wirtschaftsgüter (GWG)", art: "aktiv", gruppe: "Anlagevermögen", guv: false },
  { nummer: "0490", bezeichnung: "Software / Lizenzen", art: "aktiv", gruppe: "Anlagevermögen", guv: false },
  { nummer: "1000", bezeichnung: "Kasse", art: "aktiv", gruppe: "Finanzkonten", guv: false },
  { nummer: "1200", bezeichnung: "Bank", art: "aktiv", gruppe: "Finanzkonten", guv: false },
  { nummer: "1210", bezeichnung: "Bank (zweites Konto)", art: "aktiv", gruppe: "Finanzkonten", guv: false },
  { nummer: "1360", bezeichnung: "Geldtransit", art: "aktiv", steuer: "0", gruppe: "Finanzkonten", guv: false },
  { nummer: "1400", bezeichnung: "Forderungen aus Lieferungen und Leistungen", art: "aktiv", steuer: "0", gruppe: "Forderungen", guv: false },
  { nummer: "1576", bezeichnung: "Abziehbare Vorsteuer 19 %", art: "aktiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "1571", bezeichnung: "Abziehbare Vorsteuer 7 %", art: "aktiv", steuer: "0", gruppe: "Steuern", guv: false },
  // Bestandskonten — Passiva
  { nummer: "0800", bezeichnung: "Gezeichnetes Kapital / Eigenkapital", art: "passiv", gruppe: "Eigenkapital", guv: false },
  { nummer: "1600", bezeichnung: "Verbindlichkeiten aus Lieferungen und Leistungen", art: "passiv", steuer: "0", gruppe: "Verbindlichkeiten", guv: false },
  { nummer: "1776", bezeichnung: "Umsatzsteuer 19 %", art: "passiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "1771", bezeichnung: "Umsatzsteuer 7 %", art: "passiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "1780", bezeichnung: "Umsatzsteuer-Vorauszahlungen", art: "passiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "1800", bezeichnung: "Privatentnahmen / Gesellschafterkonto", art: "passiv", steuer: "0", gruppe: "Eigenkapital", guv: false },
  // Erloese
  { nummer: "8400", bezeichnung: "Erlöse 19 % USt", art: "ertrag", steuer: "19", gruppe: "Erlöse", guv: true },
  { nummer: "8300", bezeichnung: "Erlöse 7 % USt", art: "ertrag", steuer: "7", gruppe: "Erlöse", guv: true },
  { nummer: "8125", bezeichnung: "Steuerfreie EU-Lieferungen", art: "ertrag", steuer: "0", gruppe: "Erlöse", guv: true },
  { nummer: "8200", bezeichnung: "Erlöse (ohne USt-Ausweis)", art: "ertrag", steuer: "0", gruppe: "Erlöse", guv: true },
  { nummer: "8736", bezeichnung: "Gewährte Skonti", art: "ertrag", steuer: "19", gruppe: "Erlösschmälerungen", guv: true },
  // Aufwand — Wareneinsatz / Fremdleistung
  { nummer: "3100", bezeichnung: "Fremdleistungen / Subunternehmer", art: "aufwand", steuer: "19", gruppe: "Fremdleistungen", guv: true },
  { nummer: "3125", bezeichnung: "Leistungen § 13b UStG", art: "aufwand", steuer: "13b", gruppe: "Fremdleistungen", guv: true },
  // Aufwand — Personal
  { nummer: "4120", bezeichnung: "Gehälter", art: "aufwand", steuer: "0", gruppe: "Personalkosten", guv: true },
  { nummer: "4130", bezeichnung: "Gesetzliche Sozialaufwendungen", art: "aufwand", steuer: "0", gruppe: "Personalkosten", guv: true },
  { nummer: "4190", bezeichnung: "Aushilfslöhne", art: "aufwand", steuer: "0", gruppe: "Personalkosten", guv: true },
  // Aufwand — Raum & Betrieb
  { nummer: "4210", bezeichnung: "Miete", art: "aufwand", steuer: "0", gruppe: "Raumkosten", guv: true },
  { nummer: "4240", bezeichnung: "Gas, Strom, Wasser", art: "aufwand", steuer: "19", gruppe: "Raumkosten", guv: true },
  { nummer: "4360", bezeichnung: "Versicherungen", art: "aufwand", steuer: "0", gruppe: "Versicherungen/Beiträge", guv: true },
  { nummer: "4380", bezeichnung: "Beiträge (IHK, Verbände)", art: "aufwand", steuer: "0", gruppe: "Versicherungen/Beiträge", guv: true },
  // Aufwand — Fahrzeug & Reise
  { nummer: "4530", bezeichnung: "Laufende Kfz-Betriebskosten", art: "aufwand", steuer: "19", gruppe: "Fahrzeugkosten", guv: true },
  { nummer: "4570", bezeichnung: "Kfz-Versicherung / Steuer", art: "aufwand", steuer: "0", gruppe: "Fahrzeugkosten", guv: true },
  { nummer: "4660", bezeichnung: "Reisekosten Arbeitnehmer", art: "aufwand", steuer: "19", gruppe: "Reisekosten", guv: true },
  { nummer: "4650", bezeichnung: "Bewirtungskosten", art: "aufwand", steuer: "19", gruppe: "Reisekosten", guv: true },
  // Aufwand — Werbung & Vertrieb
  { nummer: "4600", bezeichnung: "Werbekosten (Ads, Kampagnen)", art: "aufwand", steuer: "19", gruppe: "Werbung/Vertrieb", guv: true },
  { nummer: "4610", bezeichnung: "Werbematerial / Druck", art: "aufwand", steuer: "19", gruppe: "Werbung/Vertrieb", guv: true },
  // Aufwand — IT, Software, Kommunikation
  { nummer: "4920", bezeichnung: "Telefon / Internet", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "4930", bezeichnung: "Bürobedarf", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "4965", bezeichnung: "Software / Cloud-Dienste (laufend)", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "4960", bezeichnung: "Wartung / Hosting", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  // Aufwand — Beratung & Sonstiges
  { nummer: "4950", bezeichnung: "Rechts- und Beratungskosten", art: "aufwand", steuer: "19", gruppe: "Beratung", guv: true },
  { nummer: "4955", bezeichnung: "Buchführungskosten / Steuerberatung", art: "aufwand", steuer: "19", gruppe: "Beratung", guv: true },
  { nummer: "4970", bezeichnung: "Nebenkosten des Geldverkehrs", art: "aufwand", steuer: "0", gruppe: "Sonstige Kosten", guv: true },
  { nummer: "4980", bezeichnung: "Sonstiger Betriebsbedarf", art: "aufwand", steuer: "19", gruppe: "Sonstige Kosten", guv: true },
  { nummer: "4830", bezeichnung: "Abschreibungen auf Sachanlagen", art: "aufwand", steuer: "0", gruppe: "Abschreibungen", guv: true },
  { nummer: "4855", bezeichnung: "Sofortabschreibung GWG", art: "aufwand", steuer: "0", gruppe: "Abschreibungen", guv: true },
  { nummer: "2100", bezeichnung: "Zinsaufwendungen", art: "aufwand", steuer: "0", gruppe: "Zinsen", guv: true },
  { nummer: "8736x", bezeichnung: "Erhaltene Skonti", art: "ertrag", steuer: "19", gruppe: "Sonstige Erträge", guv: true },
];

// ── SKR04 (abschlussgliedernd — an der Bilanz orientiert, GmbH/UG üblich) ──
export const SKR04: Konto[] = [
  // Aktiva
  { nummer: "0650", bezeichnung: "Betriebsausstattung", art: "aktiv", gruppe: "Anlagevermögen", guv: false },
  { nummer: "0670", bezeichnung: "Geringwertige Wirtschaftsgüter (GWG)", art: "aktiv", gruppe: "Anlagevermögen", guv: false },
  { nummer: "0135", bezeichnung: "Software / Lizenzen", art: "aktiv", gruppe: "Anlagevermögen", guv: false },
  { nummer: "1600", bezeichnung: "Kasse", art: "aktiv", gruppe: "Finanzkonten", guv: false },
  { nummer: "1800", bezeichnung: "Bank", art: "aktiv", gruppe: "Finanzkonten", guv: false },
  { nummer: "1810", bezeichnung: "Bank (zweites Konto)", art: "aktiv", gruppe: "Finanzkonten", guv: false },
  { nummer: "1460", bezeichnung: "Geldtransit", art: "aktiv", steuer: "0", gruppe: "Finanzkonten", guv: false },
  { nummer: "1200", bezeichnung: "Forderungen aus Lieferungen und Leistungen", art: "aktiv", steuer: "0", gruppe: "Forderungen", guv: false },
  { nummer: "1406", bezeichnung: "Abziehbare Vorsteuer 19 %", art: "aktiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "1401", bezeichnung: "Abziehbare Vorsteuer 7 %", art: "aktiv", steuer: "0", gruppe: "Steuern", guv: false },
  // Passiva
  { nummer: "2000", bezeichnung: "Gezeichnetes Kapital / Eigenkapital", art: "passiv", gruppe: "Eigenkapital", guv: false },
  { nummer: "3300", bezeichnung: "Verbindlichkeiten aus Lieferungen und Leistungen", art: "passiv", steuer: "0", gruppe: "Verbindlichkeiten", guv: false },
  { nummer: "3806", bezeichnung: "Umsatzsteuer 19 %", art: "passiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "3801", bezeichnung: "Umsatzsteuer 7 %", art: "passiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "3820", bezeichnung: "Umsatzsteuer-Vorauszahlungen", art: "passiv", steuer: "0", gruppe: "Steuern", guv: false },
  { nummer: "2100", bezeichnung: "Privatentnahmen / Gesellschafterkonto", art: "passiv", steuer: "0", gruppe: "Eigenkapital", guv: false },
  // Erloese
  { nummer: "4400", bezeichnung: "Erlöse 19 % USt", art: "ertrag", steuer: "19", gruppe: "Erlöse", guv: true },
  { nummer: "4300", bezeichnung: "Erlöse 7 % USt", art: "ertrag", steuer: "7", gruppe: "Erlöse", guv: true },
  { nummer: "4125", bezeichnung: "Steuerfreie EU-Lieferungen", art: "ertrag", steuer: "0", gruppe: "Erlöse", guv: true },
  { nummer: "4200", bezeichnung: "Erlöse (ohne USt-Ausweis)", art: "ertrag", steuer: "0", gruppe: "Erlöse", guv: true },
  { nummer: "4736", bezeichnung: "Gewährte Skonti", art: "ertrag", steuer: "19", gruppe: "Erlösschmälerungen", guv: true },
  // Aufwand
  { nummer: "5900", bezeichnung: "Fremdleistungen / Subunternehmer", art: "aufwand", steuer: "19", gruppe: "Fremdleistungen", guv: true },
  { nummer: "5925", bezeichnung: "Leistungen § 13b UStG", art: "aufwand", steuer: "13b", gruppe: "Fremdleistungen", guv: true },
  { nummer: "6020", bezeichnung: "Gehälter", art: "aufwand", steuer: "0", gruppe: "Personalkosten", guv: true },
  { nummer: "6110", bezeichnung: "Gesetzliche Sozialaufwendungen", art: "aufwand", steuer: "0", gruppe: "Personalkosten", guv: true },
  { nummer: "6030", bezeichnung: "Aushilfslöhne", art: "aufwand", steuer: "0", gruppe: "Personalkosten", guv: true },
  { nummer: "6310", bezeichnung: "Miete", art: "aufwand", steuer: "0", gruppe: "Raumkosten", guv: true },
  { nummer: "6325", bezeichnung: "Gas, Strom, Wasser", art: "aufwand", steuer: "19", gruppe: "Raumkosten", guv: true },
  { nummer: "6400", bezeichnung: "Versicherungen", art: "aufwand", steuer: "0", gruppe: "Versicherungen/Beiträge", guv: true },
  { nummer: "6420", bezeichnung: "Beiträge (IHK, Verbände)", art: "aufwand", steuer: "0", gruppe: "Versicherungen/Beiträge", guv: true },
  { nummer: "6530", bezeichnung: "Laufende Kfz-Betriebskosten", art: "aufwand", steuer: "19", gruppe: "Fahrzeugkosten", guv: true },
  { nummer: "6520", bezeichnung: "Kfz-Versicherung / Steuer", art: "aufwand", steuer: "0", gruppe: "Fahrzeugkosten", guv: true },
  { nummer: "6650", bezeichnung: "Reisekosten Arbeitnehmer", art: "aufwand", steuer: "19", gruppe: "Reisekosten", guv: true },
  { nummer: "6640", bezeichnung: "Bewirtungskosten", art: "aufwand", steuer: "19", gruppe: "Reisekosten", guv: true },
  { nummer: "6600", bezeichnung: "Werbekosten (Ads, Kampagnen)", art: "aufwand", steuer: "19", gruppe: "Werbung/Vertrieb", guv: true },
  { nummer: "6610", bezeichnung: "Werbematerial / Druck", art: "aufwand", steuer: "19", gruppe: "Werbung/Vertrieb", guv: true },
  { nummer: "6805", bezeichnung: "Telefon / Internet", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "6815", bezeichnung: "Bürobedarf", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "6837", bezeichnung: "Software / Cloud-Dienste (laufend)", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "6470", bezeichnung: "Wartung / Hosting", art: "aufwand", steuer: "19", gruppe: "IT/Kommunikation", guv: true },
  { nummer: "6825", bezeichnung: "Rechts- und Beratungskosten", art: "aufwand", steuer: "19", gruppe: "Beratung", guv: true },
  { nummer: "6827", bezeichnung: "Buchführungskosten / Steuerberatung", art: "aufwand", steuer: "19", gruppe: "Beratung", guv: true },
  { nummer: "6855", bezeichnung: "Nebenkosten des Geldverkehrs", art: "aufwand", steuer: "0", gruppe: "Sonstige Kosten", guv: true },
  { nummer: "6300", bezeichnung: "Sonstiger Betriebsbedarf", art: "aufwand", steuer: "19", gruppe: "Sonstige Kosten", guv: true },
  { nummer: "6220", bezeichnung: "Abschreibungen auf Sachanlagen", art: "aufwand", steuer: "0", gruppe: "Abschreibungen", guv: true },
  { nummer: "6260", bezeichnung: "Sofortabschreibung GWG", art: "aufwand", steuer: "0", gruppe: "Abschreibungen", guv: true },
  { nummer: "7300", bezeichnung: "Zinsaufwendungen", art: "aufwand", steuer: "0", gruppe: "Zinsen", guv: true },
  { nummer: "4970", bezeichnung: "Erhaltene Skonti", art: "ertrag", steuer: "19", gruppe: "Sonstige Erträge", guv: true },
];

export const KONTENRAHMEN: Record<Kontenrahmen, Konto[]> = { SKR03, SKR04 };

/** Die im laufenden Betrieb wichtigsten Konten je Rahmen — fuer Schnellbuchungen. */
export const STANDARDKONTEN: Record<Kontenrahmen, {
  bank: string;
  kasse: string;
  forderungen: string;
  verbindlichkeiten: string;
  erloese19: string;
  erloese7: string;
  ust19: string;
  ust7: string;
  vst19: string;
  vst7: string;
  geldtransit: string;
  privat: string;
}> = {
  SKR03: {
    bank: "1200", kasse: "1000", forderungen: "1400", verbindlichkeiten: "1600",
    erloese19: "8400", erloese7: "8300", ust19: "1776", ust7: "1771",
    vst19: "1576", vst7: "1571", geldtransit: "1360", privat: "1800",
  },
  SKR04: {
    bank: "1800", kasse: "1600", forderungen: "1200", verbindlichkeiten: "3300",
    erloese19: "4400", erloese7: "4300", ust19: "3806", ust7: "3801",
    vst19: "1406", vst7: "1401", geldtransit: "1460", privat: "2100",
  },
};

/** Konto-Nachschlag ueber eine Map (schnell und ohne Wiederholung). */
export function kontenMap(rahmen: Kontenrahmen, zusatz: Konto[] = []): Map<string, Konto> {
  const m = new Map<string, Konto>();
  for (const k of KONTENRAHMEN[rahmen]) m.set(k.nummer, k);
  for (const k of zusatz) m.set(k.nummer, k); // eigene Konten ueberschreiben
  return m;
}

/** Vorschlaege fuer die Kontierung anhand von Stichworten im Belegtext.
 *  Bewusst konservativ: trifft nichts zu, wird nichts vorgeschlagen. */
const REGELN: Array<{ muster: RegExp; gruppe: string }> = [
  { muster: /\b(miete|mietvertrag|b(ü|ue)ro\s?miete)\b/i, gruppe: "Raumkosten" },
  { muster: /\b(strom|gas|wasser|stadtwerke|energie)\b/i, gruppe: "Raumkosten" },
  { muster: /\b(telekom|vodafone|o2|1&1|internet|mobilfunk|telefon)\b/i, gruppe: "IT/Kommunikation" },
  { muster: /\b(aws|google\s?cloud|microsoft|azure|adobe|figma|notion|slack|hetzner|netcup|ionos|strato|github|openai|anthropic|hosting|domain|saas|abo)\b/i, gruppe: "IT/Kommunikation" },
  { muster: /\b(meta|facebook|instagram|google\s?ads|linkedin\s?ads|tiktok\s?ads|werbung|kampagne)\b/i, gruppe: "Werbung/Vertrieb" },
  { muster: /\b(steuerberat|buchhaltung|datev|lohnbuchhaltung)\b/i, gruppe: "Beratung" },
  { muster: /\b(rechtsanwalt|kanzlei|notar|beratung)\b/i, gruppe: "Beratung" },
  { muster: /\b(versicherung|allianz|huk|ergo|axa|gothaer)\b/i, gruppe: "Versicherungen/Beiträge" },
  { muster: /\b(ihk|hwk|kammer|verband|mitgliedsbeitrag)\b/i, gruppe: "Versicherungen/Beiträge" },
  { muster: /\b(tankstelle|aral|shell|esso|jet|benzin|diesel|kfz|werkstatt)\b/i, gruppe: "Fahrzeugkosten" },
  { muster: /\b(bahn|db\s|flug|lufthansa|hotel|airbnb|reise|taxi|uber)\b/i, gruppe: "Reisekosten" },
  { muster: /\b(restaurant|bewirtung|catering)\b/i, gruppe: "Reisekosten" },
  { muster: /\b(gehalt|lohn|sozialversicherung|krankenkasse|minijob)\b/i, gruppe: "Personalkosten" },
  { muster: /\b(freelanc|subunternehm|fremdleistung|werkvertrag)\b/i, gruppe: "Fremdleistungen" },
  { muster: /\b(kontof(ü|ue)hrung|bankgeb(ü|ue)hr|kontogeb(ü|ue)hr)\b/i, gruppe: "Sonstige Kosten" },
  { muster: /\b(b(ü|ue)robedarf|papier|drucker|toner)\b/i, gruppe: "IT/Kommunikation" },
];

/** Schlaegt ein Aufwandskonto anhand des Textes vor (oder null). */
export function kontoVorschlag(text: string, rahmen: Kontenrahmen): Konto | null {
  if (!text) return null;
  for (const r of REGELN) {
    if (!r.muster.test(text)) continue;
    const treffer = KONTENRAHMEN[rahmen].find((k) => k.gruppe === r.gruppe && k.art === "aufwand");
    if (treffer) return treffer;
  }
  return null;
}
