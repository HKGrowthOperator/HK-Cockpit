// lib/accounting/auswertung.ts — GuV, Summen-/Saldenliste, Umsatzsteuer-
// Voranmeldung und Kennzahlen. Alle Betraege in Cent.

import { STANDARDKONTEN } from "./kontenrahmen";
import type { Buchung, Kontenrahmen, KontoSaldo } from "./types";

// ── Gewinn- und Verlustrechnung ─────────────────────────────────────────────

export type GuVGruppe = { gruppe: string; betrag_cent: number; konten: KontoSaldo[] };

export type GuV = {
  ertraege: GuVGruppe[];
  aufwendungen: GuVGruppe[];
  summe_ertraege_cent: number;
  summe_aufwendungen_cent: number;
  ergebnis_cent: number; // Gewinn (+) oder Verlust (−)
};

function gruppiere(salden: KontoSaldo[]): GuVGruppe[] {
  const m = new Map<string, GuVGruppe>();
  for (const s of salden) {
    const g = m.get(s.gruppe) ?? { gruppe: s.gruppe, betrag_cent: 0, konten: [] };
    g.betrag_cent += s.saldo_cent;
    g.konten.push(s);
    m.set(s.gruppe, g);
  }
  return [...m.values()].sort((a, b) => b.betrag_cent - a.betrag_cent);
}

export function guv(salden: KontoSaldo[]): GuV {
  const ertraege = gruppiere(salden.filter((s) => s.art === "ertrag"));
  const aufwendungen = gruppiere(salden.filter((s) => s.art === "aufwand"));
  const se = ertraege.reduce((a, g) => a + g.betrag_cent, 0);
  const sa = aufwendungen.reduce((a, g) => a + g.betrag_cent, 0);
  return {
    ertraege,
    aufwendungen,
    summe_ertraege_cent: se,
    summe_aufwendungen_cent: sa,
    ergebnis_cent: se - sa,
  };
}

// ── Summen- und Saldenliste ─────────────────────────────────────────────────

export type SuSa = {
  zeilen: KontoSaldo[];
  summe_soll_cent: number;
  summe_haben_cent: number;
  /** Muss 0 sein — sonst ist die Buchhaltung nicht ausgeglichen. */
  differenz_cent: number;
};

export function summenSalden(salden: KontoSaldo[]): SuSa {
  const soll = salden.reduce((a, s) => a + s.soll_cent, 0);
  const haben = salden.reduce((a, s) => a + s.haben_cent, 0);
  return {
    zeilen: [...salden].sort((a, b) => a.konto.localeCompare(b.konto)),
    summe_soll_cent: soll,
    summe_haben_cent: haben,
    differenz_cent: soll - haben,
  };
}

// ── Umsatzsteuer-Voranmeldung ───────────────────────────────────────────────

export type UStVA = {
  zeitraum: string; // "2026-07" oder "2026-Q3"
  /** Kennziffern der amtlichen Voranmeldung. */
  kz81_netto_19_cent: number; // Umsaetze 19 %
  kz86_netto_7_cent: number; // Umsaetze 7 %
  kz81_steuer_cent: number;
  kz86_steuer_cent: number;
  kz66_vorsteuer_cent: number; // abziehbare Vorsteuer
  kz61_igerwerb_cent: number; // Steuer auf innergemeinschaftlichen Erwerb
  kz67_13b_cent: number; // Steuer nach § 13b
  /** Positiv = Zahllast ans Finanzamt, negativ = Erstattung. */
  zahllast_cent: number;
};

export function ustVoranmeldung(
  buchungen: Buchung[],
  rahmen: Kontenrahmen,
  von: string,
  bis: string,
  zeitraumLabel: string,
): UStVA {
  const s = STANDARDKONTEN[rahmen];
  const imZeitraum = buchungen.filter(
    (b) => b.status === "gebucht" && b.datum >= von && b.datum <= bis,
  );

  let n19 = 0, n7 = 0, st19 = 0, st7 = 0, vst = 0, ige = 0, p13b = 0;

  for (const b of imZeitraum) {
    const netto = b.betrag_cent - b.steuer_cent;
    // Erloese erkennt man daran, dass ein Ertragskonto im Haben steht.
    const istErloes = b.haben_konto === s.erloese19 || b.haben_konto === s.erloese7;
    if (istErloes) {
      if (b.steuerschluessel === "19") { n19 += netto; st19 += b.steuer_cent; }
      else if (b.steuerschluessel === "7") { n7 += netto; st7 += b.steuer_cent; }
      continue;
    }
    // Vorsteuer entsteht bei Eingangsrechnungen/Ausgaben mit USt-Ausweis.
    if (b.steuerschluessel === "19" || b.steuerschluessel === "7") {
      const istAusgabe = b.haben_konto === s.verbindlichkeiten || b.haben_konto === s.bank || b.haben_konto === s.kasse;
      if (istAusgabe) vst += b.steuer_cent;
    } else if (b.steuerschluessel === "igE") {
      ige += b.steuer_cent;
      vst += b.steuer_cent; // igE ist zugleich als Vorsteuer abziehbar
    } else if (b.steuerschluessel === "13b") {
      p13b += b.steuer_cent;
      vst += b.steuer_cent;
    }
  }

  return {
    zeitraum: zeitraumLabel,
    kz81_netto_19_cent: n19,
    kz86_netto_7_cent: n7,
    kz81_steuer_cent: st19,
    kz86_steuer_cent: st7,
    kz66_vorsteuer_cent: vst,
    kz61_igerwerb_cent: ige,
    kz67_13b_cent: p13b,
    zahllast_cent: st19 + st7 + ige + p13b - vst,
  };
}

/** Zeitraum-Grenzen fuer Monat ("2026-07") oder Quartal ("2026-Q3"). */
export function zeitraumGrenzen(zeitraum: string): { von: string; bis: string } {
  const q = zeitraum.match(/^(\d{4})-Q([1-4])$/);
  if (q) {
    const jahr = Number(q[1]);
    const startMonat = (Number(q[2]) - 1) * 3 + 1;
    const endMonat = startMonat + 2;
    return {
      von: `${jahr}-${String(startMonat).padStart(2, "0")}-01`,
      bis: letzterTag(jahr, endMonat),
    };
  }
  const m = zeitraum.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const jahr = Number(m[1]);
    const monat = Number(m[2]);
    return { von: `${jahr}-${m[2]}-01`, bis: letzterTag(jahr, monat) };
  }
  const jahr = Number(zeitraum.slice(0, 4)) || new Date().getFullYear();
  return { von: `${jahr}-01-01`, bis: `${jahr}-12-31` };
}

function letzterTag(jahr: number, monat: number): string {
  const d = new Date(Date.UTC(jahr, monat, 0)); // Tag 0 = letzter Tag des Vormonats
  return d.toISOString().slice(0, 10);
}

// ── Kennzahlen fuers Dashboard ──────────────────────────────────────────────

export type Kennzahlen = {
  einnahmen_cent: number;
  ausgaben_cent: number;
  ergebnis_cent: number;
  liquiditaet_cent: number; // Bank + Kasse
  offene_forderungen_cent: number;
  offene_verbindlichkeiten_cent: number;
  ust_zahllast_cent: number;
  buchungen_anzahl: number;
};

export function kennzahlen(
  salden: KontoSaldo[],
  buchungen: Buchung[],
  rahmen: Kontenrahmen,
  ustva: UStVA,
): Kennzahlen {
  const s = STANDARDKONTEN[rahmen];
  const saldoVon = (konto: string) => salden.find((x) => x.konto === konto)?.saldo_cent ?? 0;
  const g = guv(salden);
  return {
    einnahmen_cent: g.summe_ertraege_cent,
    ausgaben_cent: g.summe_aufwendungen_cent,
    ergebnis_cent: g.ergebnis_cent,
    liquiditaet_cent: saldoVon(s.bank) + saldoVon(s.kasse),
    offene_forderungen_cent: saldoVon(s.forderungen),
    offene_verbindlichkeiten_cent: saldoVon(s.verbindlichkeiten),
    ust_zahllast_cent: ustva.zahllast_cent,
    buchungen_anzahl: buchungen.filter((b) => b.status === "gebucht").length,
  };
}

/** Monatsverlauf fuer die Grafik: Einnahmen/Ausgaben je Monat. */
export type MonatsWert = { monat: string; einnahmen: number; ausgaben: number; ergebnis: number };

export function monatsverlauf(
  buchungen: Buchung[],
  salden: KontoSaldo[],
  jahr: number,
): MonatsWert[] {
  const ertragKonten = new Set(salden.filter((s) => s.art === "ertrag").map((s) => s.konto));
  const aufwandKonten = new Set(salden.filter((s) => s.art === "aufwand").map((s) => s.konto));
  const monate: MonatsWert[] = Array.from({ length: 12 }, (_, i) => ({
    monat: `${jahr}-${String(i + 1).padStart(2, "0")}`,
    einnahmen: 0, ausgaben: 0, ergebnis: 0,
  }));

  for (const b of buchungen) {
    if (b.status !== "gebucht" || !b.datum.startsWith(String(jahr))) continue;
    const idx = Number(b.datum.slice(5, 7)) - 1;
    if (idx < 0 || idx > 11) continue;
    const netto = (b.betrag_cent - b.steuer_cent) / 100;
    if (ertragKonten.has(b.haben_konto)) monate[idx].einnahmen += netto;
    if (aufwandKonten.has(b.soll_konto)) monate[idx].ausgaben += netto;
  }
  for (const m of monate) {
    m.einnahmen = Math.round(m.einnahmen * 100) / 100;
    m.ausgaben = Math.round(m.ausgaben * 100) / 100;
    m.ergebnis = Math.round((m.einnahmen - m.ausgaben) * 100) / 100;
  }
  return monate;
}

// ── Vergleich zum Vormonat (für die Trendanzeige im Dashboard) ─────────────

export type Trend = {
  /** Veränderung in Prozent gegenüber der Vergleichsperiode. */
  prozent: number | null;
  /** true = mehr als vorher. */
  gestiegen: boolean;
  /** Wert der Vergleichsperiode in Cent. */
  vorher_cent: number;
  aktuell_cent: number;
};

function trend(aktuell: number, vorher: number): Trend {
  const prozent = vorher === 0 ? null : Math.round(((aktuell - vorher) / Math.abs(vorher)) * 1000) / 10;
  return { prozent, gestiegen: aktuell >= vorher, vorher_cent: vorher, aktuell_cent: aktuell };
}

export type Trends = {
  einnahmen: Trend;
  ausgaben: Trend;
  ergebnis: Trend;
  monat: string; // betrachteter Monat, z. B. "Juli"
};

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Vergleicht den laufenden Monat mit dem Vormonat. */
export function monatsTrends(verlauf: MonatsWert[], jahr: number): Trends {
  const heute = new Date();
  const idx = heute.getFullYear() === jahr ? heute.getMonth() : 11;
  const jetzt = verlauf[idx] ?? { einnahmen: 0, ausgaben: 0, ergebnis: 0, monat: "" };
  const davor = verlauf[idx - 1] ?? { einnahmen: 0, ausgaben: 0, ergebnis: 0, monat: "" };
  const c = (v: number) => Math.round(v * 100);
  return {
    einnahmen: trend(c(jetzt.einnahmen), c(davor.einnahmen)),
    ausgaben: trend(c(jetzt.ausgaben), c(davor.ausgaben)),
    ergebnis: trend(c(jetzt.ergebnis), c(davor.ergebnis)),
    monat: MONATSNAMEN[idx] ?? "",
  };
}

/** Größte Kostenblöcke — für die Verteilungsgrafik. */
export type Kostenblock = { gruppe: string; betrag_cent: number; anteil: number };

export function kostenverteilung(salden: KontoSaldo[], maxGruppen = 6): Kostenblock[] {
  const nachGruppe = new Map<string, number>();
  for (const s of salden) {
    if (s.art !== "aufwand" || s.saldo_cent <= 0) continue;
    nachGruppe.set(s.gruppe, (nachGruppe.get(s.gruppe) ?? 0) + s.saldo_cent);
  }
  const sortiert = [...nachGruppe.entries()].sort((a, b) => b[1] - a[1]);
  const gesamt = sortiert.reduce((a, [, v]) => a + v, 0);
  if (!gesamt) return [];

  const oben = sortiert.slice(0, maxGruppen);
  const rest = sortiert.slice(maxGruppen).reduce((a, [, v]) => a + v, 0);
  const blocks = oben.map(([gruppe, betrag_cent]) => ({
    gruppe, betrag_cent, anteil: Math.round((betrag_cent / gesamt) * 1000) / 10,
  }));
  if (rest > 0) {
    blocks.push({ gruppe: "Sonstige", betrag_cent: rest, anteil: Math.round((rest / gesamt) * 1000) / 10 });
  }
  return blocks;
}
