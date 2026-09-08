// API: offene Bankumsätze automatisch verbuchen.
//
// GET  = Vorschau. Zeigt, was gebucht würde, ohne etwas zu schreiben.
// POST = ausführen. Legt je Umsatz eine Buchung an und hängt sie an den Umsatz.
//
// GoBD: Gebuchtes wird nie gelöscht. Falsch kontierte Posten werden über die
// Stornofunktion unter /buchhaltung/buchungen zurückgenommen.
import { NextResponse } from "next/server";
import { ladeBankUmsaetze, ladeEinstellungen, setzeBankStatus } from "@/lib/accounting/db";
import { bucheEingabe } from "@/lib/accounting/service";
import { kontiereUmsatz, erkenneGesellschafter, type Konfidenz } from "@/lib/accounting/auto-kontierung";
import { formatCent } from "@/lib/accounting/buchen";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Zeile = {
  umsatz_id: string;
  datum: string;
  betrag: string;
  partner: string | null;
  buchungstext: string;
  soll_konto: string;
  haben_konto: string;
  steuerschluessel: string;
  konfidenz: Konfidenz;
  regel: string;
};

async function vorschau(): Promise<{ zeilen: Zeile[]; zusammenfassung: Record<Konfidenz, number> }> {
  const [offen, alle, einstellungen] = await Promise.all([
    ladeBankUmsaetze("offen", 1000),
    ladeBankUmsaetze(undefined, 2000),
    ladeEinstellungen(),
  ]);
  const namen = erkenneGesellschafter(alle);

  const zusammenfassung: Record<Konfidenz, number> = { hoch: 0, mittel: 0, zu_pruefen: 0 };
  const zeilen = offen.map((u) => {
    const k = kontiereUmsatz(u, { rahmen: einstellungen.kontenrahmen, gesellschafter: namen });
    zusammenfassung[k.konfidenz]++;
    return {
      umsatz_id: u.id,
      datum: u.datum,
      betrag: formatCent(u.betrag_cent),
      partner: u.partner,
      buchungstext: k.buchungstext,
      soll_konto: k.soll_konto,
      haben_konto: k.haben_konto,
      steuerschluessel: k.steuerschluessel,
      konfidenz: k.konfidenz,
      regel: k.regel,
    };
  });

  return { zeilen, zusammenfassung };
}

export async function GET() {
  const { zeilen, zusammenfassung } = await vorschau();
  return NextResponse.json({ offen: zeilen.length, zusammenfassung, zeilen });
}

export async function POST() {
  const [offen, alle, einstellungen] = await Promise.all([
    ladeBankUmsaetze("offen", 1000),
    ladeBankUmsaetze(undefined, 2000),
    ladeEinstellungen(),
  ]);
  const namen = erkenneGesellschafter(alle);

  let gebucht = 0;
  const fehler: string[] = [];
  const zusammenfassung: Record<Konfidenz, number> = { hoch: 0, mittel: 0, zu_pruefen: 0 };

  // Bewusst nacheinander: die Buchungsnummern sind ein fortlaufender
  // Nummernkreis, parallele Vergabe würde Lücken oder Dubletten erzeugen.
  for (const u of offen) {
    const k = kontiereUmsatz(u, { rahmen: einstellungen.kontenrahmen, gesellschafter: namen });
    try {
      const buchung = await bucheEingabe({
        datum: u.datum,
        buchungstext: k.buchungstext,
        betrag: Math.abs(u.betrag_cent) / 100,
        steuerschluessel: k.steuerschluessel,
        soll_konto: k.soll_konto,
        haben_konto: k.haben_konto,
        bank_umsatz_id: u.id,
        erstellt_von: `auto-kontierung:${k.regel}`,
      });
      await setzeBankStatus(u.id, "zugeordnet", null, buchung.id);
      zusammenfassung[k.konfidenz]++;
      gebucht++;
    } catch (err) {
      const grund = err instanceof Error ? err.message : "unbekannter Fehler";
      fehler.push(`${u.datum} ${formatCent(u.betrag_cent)}: ${grund}`);
    }
  }

  return NextResponse.json({
    gebucht,
    uebersprungen: fehler.length,
    zusammenfassung,
    fehler: fehler.slice(0, 20),
  });
}
