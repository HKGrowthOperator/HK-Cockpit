// lib/accounting/service.ts — Buchungsvorgänge, die die Datenbank brauchen.
// Bewusst getrennt von lib/accounting/buchen.ts: Jenes enthält nur reine
// Rechen- und Prüflogik und darf deshalb auch im Browser geladen werden.
import "server-only";

import { ladeKonten, speichereBuchung } from "./db";
import { pruefeBuchung, steuerAusBrutto, toCent, type BuchungEingabe } from "./buchen";
import type { Buchung } from "./types";

/** Prüft die Eingabe und schreibt die Buchung. Wirft bei Fehlern mit
 *  lesbarer Meldung, die direkt in der Oberfläche angezeigt werden kann. */
export async function bucheEingabe(e: BuchungEingabe): Promise<Buchung> {
  const konten = new Map((await ladeKonten()).map((k) => [k.nummer, k]));
  const pruefung = pruefeBuchung(e, konten);
  if (!pruefung.ok) throw new Error(pruefung.fehler.join(" "));

  const betrag = toCent(e.betrag);
  return speichereBuchung({
    datum: e.datum,
    buchungstext: e.buchungstext.trim(),
    betrag_cent: betrag,
    steuer_cent: steuerAusBrutto(betrag, e.steuerschluessel),
    steuerschluessel: e.steuerschluessel,
    soll_konto: e.soll_konto,
    haben_konto: e.haben_konto,
    beleg_id: e.beleg_id ?? null,
    rechnung_id: e.rechnung_id ?? null,
    bank_umsatz_id: e.bank_umsatz_id ?? null,
    status: "gebucht",
    geschaeftsjahr: Number(e.datum.slice(0, 4)),
    erstellt_von: e.erstellt_von ?? null,
  });
}
