// Prüft die Rechenlogik der Buchhaltung — ohne Datenbank, damit der Test
// überall läuft. Aufruf aus web/:  npm run test:buchhaltung
//
// Abgedeckt: Betragsformate, Umsatzsteuer, Buchungssätze, Validierung,
// Steueraufteilung in den Salden, GuV, UStVA, Bank-CSV samt Zahlungsabgleich,
// DATEV-Export und Kontierungsvorschläge.
import { toCent, formatCent, steuerAusBrutto, nettoAusBrutto, kontierung, pruefeBuchung } from "@/lib/accounting/buchen";
import { guv, summenSalden, ustVoranmeldung, monatsverlauf, monatsTrends, kostenverteilung, zeitraumGrenzen } from "@/lib/accounting/auswertung";
import { parseBankCSV, ordneZu } from "@/lib/accounting/bank-csv";
import { berechneSalden } from "@/lib/accounting/salden";
import { datevExport } from "@/lib/accounting/datev";
import { KONTENRAHMEN, STANDARDKONTEN, kontoVorschlag } from "@/lib/accounting/kontenrahmen";
import type { Buchung, KontoSaldo } from "@/lib/accounting/types";

let fehler = 0;
const ok = (name: string, bedingung: boolean, info = "") => {
  console.log(`${bedingung ? "  OK  " : " FEHL "} ${name}${info ? " — " + info : ""}`);
  if (!bedingung) fehler++;
};

console.log("\n── Beträge ──");
ok("deutsches Format 1.234,56", toCent("1.234,56") === 123456, String(toCent("1.234,56")));
ok("englisches Format 1234.56", toCent("1234.56") === 123456, String(toCent("1234.56")));
ok("mit Euro-Zeichen", toCent("119,00 €") === 11900, String(toCent("119,00 €")));
ok("negativ", toCent("-45,20") === -4520, String(toCent("-45,20")));
ok("Formatierung", formatCent(123456).includes("1.234,56"), formatCent(123456));

console.log("\n── Umsatzsteuer ──");
ok("19 % aus 119 € brutto = 19 €", steuerAusBrutto(11900, "19") === 1900, formatCent(steuerAusBrutto(11900, "19")));
ok("7 % aus 107 € brutto = 7 €", steuerAusBrutto(10700, "7") === 700, formatCent(steuerAusBrutto(10700, "7")));
ok("netto aus brutto", nettoAusBrutto(11900, "19") === 10000, formatCent(nettoAusBrutto(11900, "19")));
ok("ohne Steuer", steuerAusBrutto(5000, "0") === 0);
ok("§13b: Steuer zusätzlich", steuerAusBrutto(10000, "13b") === 1900, formatCent(steuerAusBrutto(10000, "13b")));

console.log("\n── Buchungssätze (SKR04) ──");
const s = STANDARDKONTEN.SKR04;
const k1 = kontierung("ausgangsrechnung", "SKR04", "4400");
ok("Ausgangsrechnung: Forderung an Erlös", k1.soll === s.forderungen && k1.haben === "4400", `${k1.soll} an ${k1.haben}`);
const k2 = kontierung("zahlungseingang", "SKR04", "");
ok("Zahlungseingang: Bank an Forderung", k2.soll === s.bank && k2.haben === s.forderungen, `${k2.soll} an ${k2.haben}`);
const k3 = kontierung("eingangsrechnung", "SKR04", "6837");
ok("Eingangsrechnung: Aufwand an Verbindlichkeit", k3.soll === "6837" && k3.haben === s.verbindlichkeiten, `${k3.soll} an ${k3.haben}`);
const k4 = kontierung("barausgabe", "SKR04", "6600");
ok("Ausgabe direkt: Aufwand an Bank", k4.soll === "6600" && k4.haben === s.bank, `${k4.soll} an ${k4.haben}`);

console.log("\n── Validierung ──");
const konten = new Map(KONTENRAHMEN.SKR04.map((k) => [k.nummer, k]));
const basis = { datum: "2026-07-15", buchungstext: "Test", betrag: "119,00", steuerschluessel: "19" as const };
ok("gültige Buchung", pruefeBuchung({ ...basis, soll_konto: "6837", haben_konto: "1800" }, konten).ok);
ok("gleiches Konto abgelehnt", !pruefeBuchung({ ...basis, soll_konto: "1800", haben_konto: "1800" }, konten).ok);
ok("Betrag 0 abgelehnt", !pruefeBuchung({ ...basis, betrag: "0", soll_konto: "6837", haben_konto: "1800" }, konten).ok);
ok("unbekanntes Konto abgelehnt", !pruefeBuchung({ ...basis, soll_konto: "9999", haben_konto: "1800" }, konten).ok);
ok("falsches Datum abgelehnt", !pruefeBuchung({ ...basis, datum: "15.07.2026", soll_konto: "6837", haben_konto: "1800" }, konten).ok);

console.log("\n── Auswertungen ──");
// Beispiel: 2 Erlöse (10.000 netto), 1 Kosten (1.000 netto)
const buchungen: Buchung[] = [
  { id: "1", buchungsnummer: "2026-00001", datum: "2026-03-10", buchungstext: "Projekt A", betrag_cent: 595000, steuer_cent: 95000, steuerschluessel: "19", soll_konto: "1200", haben_konto: "4400", status: "gebucht", geschaeftsjahr: 2026, erstellt_am: "" },
  { id: "2", buchungsnummer: "2026-00002", datum: "2026-07-05", buchungstext: "Projekt B", betrag_cent: 595000, steuer_cent: 95000, steuerschluessel: "19", soll_konto: "1200", haben_konto: "4400", status: "gebucht", geschaeftsjahr: 2026, erstellt_am: "" },
  { id: "3", buchungsnummer: "2026-00003", datum: "2026-07-08", buchungstext: "Hosting", betrag_cent: 119000, steuer_cent: 19000, steuerschluessel: "19", soll_konto: "6837", haben_konto: "3300", status: "gebucht", geschaeftsjahr: 2026, erstellt_am: "" },
];
// Salden werden aus den Buchungen berechnet — inkl. Steueraufteilung.
const salden: KontoSaldo[] = berechneSalden(buchungen, KONTENRAHMEN.SKR04, "SKR04");

const g = guv(salden);
ok("GuV Erträge = netto (nicht brutto)", g.summe_ertraege_cent === 1000000, formatCent(g.summe_ertraege_cent));
ok("GuV Aufwendungen = netto", g.summe_aufwendungen_cent === 100000, formatCent(g.summe_aufwendungen_cent));
ok("GuV Ergebnis = Ertrag − Aufwand", g.ergebnis_cent === 900000, formatCent(g.ergebnis_cent));

const su = summenSalden(salden);
ok("Summen/Salden ausgeglichen (Soll = Haben)", su.differenz_cent === 0, `Differenz ${formatCent(su.differenz_cent)}`);
const ustKonto = salden.find((x) => x.konto === "3806");
ok("Umsatzsteuerkonto bebucht", ustKonto?.saldo_cent === 190000, formatCent(ustKonto?.saldo_cent ?? 0));
const vstKonto = salden.find((x) => x.konto === "1406");
ok("Vorsteuerkonto bebucht", vstKonto?.saldo_cent === 19000, formatCent(vstKonto?.saldo_cent ?? 0));
const forderung = salden.find((x) => x.konto === "1200");
ok("Forderung brutto", forderung?.saldo_cent === 1190000, formatCent(forderung?.saldo_cent ?? 0));

const grenzen = zeitraumGrenzen("2026-07");
ok("Monatsgrenzen Juli", grenzen.von === "2026-07-01" && grenzen.bis === "2026-07-31", `${grenzen.von} … ${grenzen.bis}`);
const q = zeitraumGrenzen("2026-Q3");
ok("Quartalsgrenzen Q3", q.von === "2026-07-01" && q.bis === "2026-09-30", `${q.von} … ${q.bis}`);

const ust = ustVoranmeldung(buchungen, "SKR04", "2026-07-01", "2026-07-31", "2026-07");
ok("USt Juli: Umsatz 19 % netto", ust.kz81_netto_19_cent === 500000, formatCent(ust.kz81_netto_19_cent));
ok("USt Juli: Umsatzsteuer", ust.kz81_steuer_cent === 95000, formatCent(ust.kz81_steuer_cent));
ok("USt Juli: Vorsteuer", ust.kz66_vorsteuer_cent === 19000, formatCent(ust.kz66_vorsteuer_cent));
ok("USt Juli: Zahllast = USt − VSt", ust.zahllast_cent === 76000, formatCent(ust.zahllast_cent));

const verlauf = monatsverlauf(buchungen, salden, 2026);
ok("Verlauf: März Einnahmen", verlauf[2].einnahmen === 5000, String(verlauf[2].einnahmen));
ok("Verlauf: Juli Einnahmen", verlauf[6].einnahmen === 5000, String(verlauf[6].einnahmen));
ok("Verlauf: Juli Ausgaben", verlauf[6].ausgaben === 1000, String(verlauf[6].ausgaben));
ok("Verlauf: 12 Monate", verlauf.length === 12);

const tr = monatsTrends(verlauf, 2026);
ok("Trends liefern Monatsnamen", tr.monat.length > 0, tr.monat);

const kv = kostenverteilung(salden);
ok("Kostenverteilung: 1 Block", kv.length === 1 && kv[0].anteil === 100, `${kv[0]?.gruppe} ${kv[0]?.anteil}%`);

console.log("\n── Bank-CSV ──");
const csv = `"Buchungstag";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Betrag";"Waehrung"
"05.07.2026";"Rechnung RE-2026-0007 Projekt B";"Muster GmbH";"5.950,00";"EUR"
"08.07.2026";"Hosting Juli";"Hetzner Online GmbH";"-119,00";"EUR"
"09.07.2026";"Zahlung ohne Zuordnung";"Unbekannt";"250,00";"EUR"`;
const erg = parseBankCSV(csv);
ok("CSV: 3 Umsätze gelesen", erg.umsaetze.length === 3, String(erg.umsaetze.length));
ok("CSV: Datum normalisiert", erg.umsaetze[0].datum === "2026-07-05", erg.umsaetze[0].datum);
ok("CSV: Betrag positiv", erg.umsaetze[0].betrag_cent === 595000, formatCent(erg.umsaetze[0].betrag_cent));
ok("CSV: Betrag negativ", erg.umsaetze[1].betrag_cent === -11900, formatCent(erg.umsaetze[1].betrag_cent));
ok("CSV: Partner erkannt", erg.umsaetze[1].partner === "Hetzner Online GmbH", String(erg.umsaetze[1].partner));
ok("CSV: dedup_key stabil", parseBankCSV(csv).umsaetze[0].dedup_key === erg.umsaetze[0].dedup_key);

const umsaetze = erg.umsaetze.map((u, i) => ({ ...u, id: `u${i}`, status: "offen" as const, rechnung_id: null, buchung_id: null, erstellt_am: "" }));
const treffer = ordneZu(umsaetze, [
  { id: "r1", invoice_id: "RE-2026-0007", company: "Muster GmbH", customer_name: "Max Muster", amount_cent: 595000 },
  { id: "r2", invoice_id: "RE-2026-0099", company: "Andere AG", customer_name: "Eva Anders", amount_cent: 100000 },
]);
ok("Abgleich: 1 Treffer", treffer.length === 1, String(treffer.length));
ok("Abgleich: richtige Rechnung", treffer[0]?.rechnung.invoice_id === "RE-2026-0007", treffer[0]?.rechnung.invoice_id);
ok("Abgleich: 100 % Sicherheit", treffer[0]?.sicherheit === 100, String(treffer[0]?.sicherheit));

console.log("\n── DATEV-Export ──");
const datev = datevExport(buchungen, { firma: "HK Growth Operator", jahr: 2026, rahmen: "SKR04" });
const zeilen = datev.trim().split("\r\n");
ok("DATEV: Kopf EXTF", zeilen[0].startsWith('"EXTF";700;21'), zeilen[0].slice(0, 24));
ok("DATEV: Spaltenzeile", zeilen[1].includes("Soll/Haben-Kennzeichen"));
ok("DATEV: 3 Buchungszeilen", zeilen.length === 5, `${zeilen.length} Zeilen gesamt`);
ok("DATEV: Betrag mit Komma", zeilen[2].startsWith("5950,00"), zeilen[2].slice(0, 30));
ok("DATEV: Belegdatum TTMM", zeilen[2].includes(";1003;"), "März → 1003");

console.log("\n── Kontierungsvorschlag ──");
ok("Hetzner → IT/Kommunikation", kontoVorschlag("Rechnung Hetzner Online", "SKR04")?.gruppe === "IT/Kommunikation");
ok("Miete → Raumkosten", kontoVorschlag("Büromiete August", "SKR04")?.gruppe === "Raumkosten");
ok("Steuerberater → Beratung", kontoVorschlag("Kanzlei Steuerberatung", "SKR04")?.gruppe === "Beratung");
ok("unbekannt → kein Vorschlag", kontoVorschlag("Zahlung 12345", "SKR04") === null);

console.log(`\n${fehler === 0 ? "Alle Prüfungen bestanden." : `${fehler} Prüfung(en) fehlgeschlagen.`}\n`);
process.exit(fehler === 0 ? 0 : 1);
