// lib/accounting/laden.ts — sammelt alles, was die Buchhaltungsseiten brauchen,
// in einem Aufruf. Hält die Seiten-Komponenten schlank.

import { ladeBuchungen, ladeSalden, ladeEinstellungen, ladeKonten, ladeBelege, ladeBankUmsaetze } from "./db";
import { guv, kennzahlen, monatsverlauf, summenSalden, ustVoranmeldung, zeitraumGrenzen } from "./auswertung";
import type { Kontenrahmen } from "./types";

export type Jahresdaten = Awaited<ReturnType<typeof ladeJahresdaten>>;

export async function ladeJahresdaten(jahr: number, ustZeitraum?: string) {
  const [einstellungen, buchungen, salden, konten] = await Promise.all([
    ladeEinstellungen(),
    ladeBuchungen({ jahr, limit: 5000 }),
    ladeSalden(jahr),
    ladeKonten(),
  ]);

  const rahmen: Kontenrahmen = einstellungen.kontenrahmen;
  const zeitraum = ustZeitraum ?? aktuellerMonat(jahr);
  const { von, bis } = zeitraumGrenzen(zeitraum);
  const ustva = ustVoranmeldung(buchungen, rahmen, von, bis, zeitraum);

  return {
    jahr,
    einstellungen,
    konten,
    buchungen,
    salden,
    guv: guv(salden),
    susa: summenSalden(salden),
    ustva,
    kennzahlen: kennzahlen(salden, buchungen, rahmen, ustva),
    verlauf: monatsverlauf(buchungen, salden, jahr),
  };
}

function aktuellerMonat(jahr: number): string {
  const heute = new Date();
  const monat = heute.getFullYear() === jahr ? heute.getMonth() + 1 : 12;
  return `${jahr}-${String(monat).padStart(2, "0")}`;
}

/** Offene Belege und Bankumsätze — für die Arbeitsliste im Dashboard. */
export async function ladeArbeitsvorrat() {
  const [belege, bank] = await Promise.all([ladeBelege("offen", 100), ladeBankUmsaetze("offen", 100)]);
  return { offeneBelege: belege, offeneBankUmsaetze: bank };
}
