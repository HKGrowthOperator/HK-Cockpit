import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { VerlaufChart } from "@/components/buchhaltung/verlauf-chart";
import { ladeJahresdaten, ladeArbeitsvorrat } from "@/lib/accounting/laden";
import { formatCent } from "@/lib/accounting/buchen";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const p = await searchParams;
  const jahr = Number(p.jahr) || new Date().getFullYear();

  const [daten, vorrat] = await Promise.all([ladeJahresdaten(jahr), ladeArbeitsvorrat()]);
  const k = daten.kennzahlen;
  const leer = k.buchungen_anzahl === 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Buchhaltung {jahr}</h1>
          <p className="text-sm text-muted-foreground">
            Doppelte Buchführung nach {daten.einstellungen.kontenrahmen}
            {daten.einstellungen.firma ? ` · ${daten.einstellungen.firma}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/buchhaltung/buchungen" className="rounded-md border border-border px-3 py-1.5">
            Buchungen
          </Link>
          <Link href="/buchhaltung/belege" className="rounded-md border border-border px-3 py-1.5">
            Belege {vorrat.offeneBelege.length > 0 && `(${vorrat.offeneBelege.length})`}
          </Link>
          <Link href="/buchhaltung/bank" className="rounded-md border border-border px-3 py-1.5">
            Bank {vorrat.offeneBankUmsaetze.length > 0 && `(${vorrat.offeneBankUmsaetze.length})`}
          </Link>
          <Link href="/buchhaltung/auswertungen" className="rounded-md border border-border px-3 py-1.5">
            Auswertungen
          </Link>
        </div>
      </div>

      {leer && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Noch keine Buchungen für {jahr}.</p>
            <p>
              Leg los: Beleg unter <Link href="/buchhaltung/belege" className="underline">Belege</Link>{" "}
              hochladen, Kontoauszug unter <Link href="/buchhaltung/bank" className="underline">Bank</Link>{" "}
              einlesen oder direkt unter{" "}
              <Link href="/buchhaltung/buchungen" className="underline">Buchungen</Link> erfassen.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Einnahmen (netto)" value={formatCent(k.einnahmen_cent)}
          hint={`${jahr} kumuliert`} tone="good" />
        <StatCard label="Ausgaben (netto)" value={formatCent(k.ausgaben_cent)}
          hint={`${jahr} kumuliert`} />
        <StatCard label="Ergebnis" value={formatCent(k.ergebnis_cent)}
          hint={k.ergebnis_cent >= 0 ? "Gewinn" : "Verlust"}
          tone={k.ergebnis_cent >= 0 ? "good" : "bad"} />
        <StatCard label="Liquidität" value={formatCent(k.liquiditaet_cent)}
          hint="Bank und Kasse" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Offene Forderungen" value={formatCent(k.offene_forderungen_cent)}
          hint="Kunden schulden uns" tone={k.offene_forderungen_cent > 0 ? "warn" : "default"} />
        <StatCard label="Offene Verbindlichkeiten" value={formatCent(k.offene_verbindlichkeiten_cent)}
          hint="wir schulden Lieferanten" />
        <StatCard label={`USt ${daten.ustva.zeitraum}`} value={formatCent(k.ust_zahllast_cent)}
          hint={k.ust_zahllast_cent >= 0 ? "Zahllast ans Finanzamt" : "Erstattung"}
          tone={k.ust_zahllast_cent > 0 ? "warn" : "good"} />
        <StatCard label="Buchungen" value={String(k.buchungen_anzahl)} hint={`im Jahr ${jahr}`} />
      </div>

      {(vorrat.offeneBelege.length > 0 || vorrat.offeneBankUmsaetze.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Zu erledigen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {vorrat.offeneBelege.length > 0 && (
              <Link href="/buchhaltung/belege"
                className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/50">
                <span>{vorrat.offeneBelege.length} Beleg(e) warten auf Verbuchung</span>
                <span className="text-muted-foreground">→</span>
              </Link>
            )}
            {vorrat.offeneBankUmsaetze.length > 0 && (
              <Link href="/buchhaltung/bank"
                className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/50">
                <span>{vorrat.offeneBankUmsaetze.length} Bankumsatz/-umsätze nicht zugeordnet</span>
                <span className="text-muted-foreground">→</span>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Einnahmen und Ausgaben je Monat</CardTitle>
        </CardHeader>
        <CardContent>
          {leer ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sobald gebucht wird, erscheint hier der Jahresverlauf.
            </p>
          ) : (
            <VerlaufChart data={daten.verlauf} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
