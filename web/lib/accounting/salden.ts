// lib/accounting/salden.ts — Salden aus Buchungen berechnen, inklusive
// automatischer Steueraufteilung.
//
// Warum das nötig ist: Eine Buchung wird als EIN Satz erfasst (Bruttobetrag +
// Steuerschlüssel), so wie es auch DATEV mit dem BU-Schlüssel macht. Für GuV,
// Bilanz und Umsatzsteuer muss daraus aber der Dreisatz werden:
//
//   Forderung 1.190 € an Erlöse 1.000 € und Umsatzsteuer 190 €
//
// Ohne diese Aufteilung stünde der Bruttobetrag im Erlös (GuV zu hoch) und das
// Umsatzsteuerkonto bliebe leer. Die Aufteilung passiert deshalb hier zentral —
// die Journal-Zeile selbst bleibt schlank und DATEV-kompatibel.

import { STANDARDKONTEN } from "./kontenrahmen";
import type { Buchung, Konto, Kontenrahmen, KontoSaldo } from "./types";

type Bewegung = { konto: string; soll: number; haben: number };

/** Steuerkonto für einen Buchungsfall: Umsatzsteuer bei Erlösen,
 *  Vorsteuer bei Aufwand. Null, wenn keine Steuer anfällt. */
function steuerkonto(
  b: Buchung,
  rahmen: Kontenrahmen,
  konten: Map<string, Konto>,
): { konto: string; seite: "soll" | "haben" } | null {
  if (b.steuer_cent === 0) return null;
  const s = STANDARDKONTEN[rahmen];
  const sollArt = konten.get(b.soll_konto)?.art;
  const habenArt = konten.get(b.haben_konto)?.art;

  // Erlös im Haben → Umsatzsteuer, ebenfalls im Haben (Schuld ans Finanzamt).
  if (habenArt === "ertrag") {
    return { konto: b.steuerschluessel === "7" ? s.ust7 : s.ust19, seite: "haben" };
  }
  // Aufwand im Soll → Vorsteuer, ebenfalls im Soll (Forderung ans Finanzamt).
  if (sollArt === "aufwand") {
    return { konto: b.steuerschluessel === "7" ? s.vst7 : s.vst19, seite: "soll" };
  }
  // Anlagenzugang (aktiv) mit Vorsteuer — z. B. Notebook auf 0650/0400.
  // Der Erlösfall ist oben bereits abgefangen, hier bleibt nur der Zugang.
  if (sollArt === "aktiv" && b.steuerschluessel !== "0") {
    return { konto: b.steuerschluessel === "7" ? s.vst7 : s.vst19, seite: "soll" };
  }
  return null;
}

/** Zerlegt eine Buchung in ihre Kontobewegungen (mit Steueraufteilung). */
export function bewegungen(
  b: Buchung,
  rahmen: Kontenrahmen,
  konten: Map<string, Konto>,
): Bewegung[] {
  const brutto = b.betrag_cent;
  const steuer = b.steuer_cent;
  const st = steuerkonto(b, rahmen, konten);

  // Ohne Steueraufteilung: schlichter Zweisatz.
  if (!st || steuer === 0) {
    return [
      { konto: b.soll_konto, soll: brutto, haben: 0 },
      { konto: b.haben_konto, soll: 0, haben: brutto },
    ];
  }

  // Reverse Charge (§ 13b, EU-Erwerb): Der Rechnungsbetrag ist netto. Die
  // Steuer wird zusätzlich gebucht — als Schuld UND als Vorsteuer, sie hebt
  // sich also auf. Der Aufwand bleibt in voller Höhe stehen.
  if (b.steuerschluessel === "13b" || b.steuerschluessel === "igE") {
    const s = STANDARDKONTEN[rahmen];
    return [
      { konto: b.soll_konto, soll: brutto, haben: 0 },
      { konto: b.haben_konto, soll: 0, haben: brutto },
      { konto: s.vst19, soll: steuer, haben: 0 }, // abziehbare Vorsteuer
      { konto: s.ust19, soll: 0, haben: steuer }, // geschuldete Umsatzsteuer
    ];
  }

  const netto = brutto - steuer;

  if (st.seite === "haben") {
    // Forderung/Bank (brutto) an Erlös (netto) + Umsatzsteuer (Steueranteil).
    return [
      { konto: b.soll_konto, soll: brutto, haben: 0 },
      { konto: b.haben_konto, soll: 0, haben: netto },
      { konto: st.konto, soll: 0, haben: steuer },
    ];
  }
  // Aufwand (netto) + Vorsteuer (Steueranteil) an Verbindlichkeit/Bank (brutto).
  return [
    { konto: b.soll_konto, soll: netto, haben: 0 },
    { konto: st.konto, soll: steuer, haben: 0 },
    { konto: b.haben_konto, soll: 0, haben: brutto },
  ];
}

/** Summen und Salden je Konto — Grundlage für GuV, Bilanz und SuSa-Liste. */
export function berechneSalden(
  buchungen: Buchung[],
  konten: Konto[],
  rahmen: Kontenrahmen,
): KontoSaldo[] {
  const kontoMap = new Map(konten.map((k) => [k.nummer, k]));
  const summen = new Map<string, { soll: number; haben: number }>();

  for (const b of buchungen) {
    if (b.status !== "gebucht") continue;
    for (const bew of bewegungen(b, rahmen, kontoMap)) {
      const s = summen.get(bew.konto) ?? { soll: 0, haben: 0 };
      s.soll += bew.soll;
      s.haben += bew.haben;
      summen.set(bew.konto, s);
    }
  }

  const ergebnis: KontoSaldo[] = [];
  for (const [nummer, s] of summen) {
    const k = kontoMap.get(nummer);
    if (!k) continue; // unbekanntes Konto (sollte durch Validierung ausgeschlossen sein)
    // Aktiv- und Aufwandskonten haben Sollsaldo, Passiv- und Ertragskonten Habensaldo.
    const saldo = k.art === "aktiv" || k.art === "aufwand" ? s.soll - s.haben : s.haben - s.soll;
    ergebnis.push({
      konto: nummer,
      bezeichnung: k.bezeichnung,
      art: k.art,
      gruppe: k.gruppe,
      soll_cent: s.soll,
      haben_cent: s.haben,
      saldo_cent: saldo,
    });
  }
  return ergebnis.sort((a, b) => a.konto.localeCompare(b.konto));
}
