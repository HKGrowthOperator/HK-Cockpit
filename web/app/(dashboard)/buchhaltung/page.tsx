import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiKarte } from "@/components/buchhaltung/kpi-karte";
import { KostenVerteilung } from "@/components/buchhaltung/kosten-verteilung";
import { VerlaufChart } from "@/components/buchhaltung/verlauf-chart";
import { ladeJahresdaten, ladeArbeitsvorrat } from "@/lib/accounting/laden";
import { kostenverteilung, monatsTrends } from "@/lib/accounting/auswertung";
import { formatCent } from "@/lib/accounting/buchen";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/buchhaltung/buchungen", label: "Buchungen" },
  { href: "/buchhaltung/belege", label: "Belege" },
  { href: "/buchhaltung/bank", label: "Bank" },
  { href: "/buchhaltung/auswertungen", label: "Auswertungen" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const p = await searchParams;
  const jahr = Number(p.jahr) || new Date().getFullYear();

  const [daten, vorrat] = await Promise.all([ladeJahresdaten(jahr), ladeArbeitsvorrat()]);
  const k = daten.kennzahlen;
  const trends = monatsTrends(daten.verlauf, jahr);
  const kosten = kostenverteilung(daten.salden);
  const leer = k.buchungen_anzahl === 0;

  const letzte = daten.buchungen.slice(0, 8);
  const zuErledigen = vorrat.offeneBelege.length + vorrat.offeneBankUmsaetze.length;

  return (
    <div className="grid gap-6">
      {/* ── Kopfzeile ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {daten.einstellungen.kontenrahmen}
            </span>
            <span>Doppelte Buchführung</span>
            {daten.einstellungen.firma && <span>· {daten.einstellungen.firma}</span>}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Buchhaltung {jahr}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border p-1">
            {[jahr - 1, jahr, jahr + 1].map((j) => (
              <Link key={j} href={`/buchhaltung?jahr=${j}`}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  j === jahr ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}>
                {j}
              </Link>
            ))}
          </div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="rounded-full border px-3.5 py-1.5 text-sm transition-colors hover:bg-muted">
              {n.label}
              {n.label === "Belege" && vorrat.offeneBelege.length > 0 && (
                <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 text-xs text-gold-ink">
                  {vorrat.offeneBelege.length}
                </span>
              )}
              {n.label === "Bank" && vorrat.offeneBankUmsaetze.length > 0 && (
                <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 text-xs text-gold-ink">
                  {vorrat.offeneBankUmsaetze.length}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Leerzustand mit klarem Einstieg ───────────────────────── */}
      {leer && (
        <div className="rounded-2xl border border-dashed bg-card/60 p-8 text-center">
          <h2 className="text-lg font-medium">Noch keine Buchungen für {jahr}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Drei Wege hinein: Beleg hochladen, Kontoauszug einlesen oder direkt buchen.
            Alles andere entsteht daraus von selbst.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/buchhaltung/belege"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Beleg hochladen
            </Link>
            <Link href="/buchhaltung/bank" className="rounded-full border px-4 py-2 text-sm">
              Kontoauszug einlesen
            </Link>
            <Link href="/buchhaltung/buchungen" className="rounded-full border px-4 py-2 text-sm">
              Buchung erfassen
            </Link>
          </div>
        </div>
      )}

      {/* ── Kennzahlen ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiKarte label="Einnahmen" wert={formatCent(k.einnahmen_cent)} ton="gut"
          hinweis={`netto · Jahr ${jahr}`} trend={trends.einnahmen}
          fuss={`${trends.monat}: ${formatCent(trends.einnahmen.aktuell_cent)}`} />
        <KpiKarte label="Ausgaben" wert={formatCent(k.ausgaben_cent)} ton="gold"
          hinweis={`netto · Jahr ${jahr}`} trend={trends.ausgaben} wenigerIstBesser
          fuss={`${trends.monat}: ${formatCent(trends.ausgaben.aktuell_cent)}`} />
        <KpiKarte label="Ergebnis" wert={formatCent(k.ergebnis_cent)}
          ton={k.ergebnis_cent >= 0 ? "gut" : "schlecht"}
          hinweis={k.ergebnis_cent >= 0 ? "Gewinn vor Steuern" : "Verlust"}
          trend={trends.ergebnis} />
        <KpiKarte label="Liquidität" wert={formatCent(k.liquiditaet_cent)}
          ton={k.liquiditaet_cent < 0 ? "schlecht" : "neutral"} hinweis="Bank und Kasse"
          fuss={
            <span className="flex justify-between">
              <span>Offene Forderungen</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatCent(k.offene_forderungen_cent)}
              </span>
            </span>
          } />
      </div>

      {/* ── Verlauf + Kostenblöcke ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Jahresverlauf</CardTitle>
              <p className="text-sm text-muted-foreground">Einnahmen und Ausgaben je Monat, netto</p>
            </div>
          </CardHeader>
          <CardContent>
            {leer ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sobald gebucht wird, erscheint hier der Verlauf.
              </p>
            ) : (
              <VerlaufChart data={daten.verlauf} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wohin das Geld geht</CardTitle>
            <p className="text-sm text-muted-foreground">Kostenblöcke im Jahr {jahr}</p>
          </CardHeader>
          <CardContent>
            <KostenVerteilung blocks={kosten} />
          </CardContent>
        </Card>
      </div>

      {/* ── Arbeitsvorrat + Umsatzsteuer ──────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Letzte Buchungen</CardTitle>
            <Link href="/buchhaltung/buchungen" className="text-sm text-muted-foreground hover:text-foreground">
              alle ansehen →
            </Link>
          </CardHeader>
          <CardContent>
            {letzte.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Noch nichts gebucht.
              </p>
            ) : (
              <div className="grid">
                {letzte.map((b) => (
                  <div key={b.id}
                    className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                        {b.datum.slice(8, 10)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{b.buchungstext}</div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{b.soll_konto}</span> an{" "}
                          <span className="font-mono">{b.haben_konto}</span>
                          {b.status === "storniert" && " · storniert"}
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 text-sm font-medium tabular-nums ${
                      b.status === "storniert" ? "text-muted-foreground line-through" : ""
                    }`}>
                      {formatCent(b.betrag_cent)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Umsatzsteuer</CardTitle>
              <p className="text-sm text-muted-foreground">{daten.ustva.zeitraum}</p>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Umsatzsteuer</span>
                <span className="tabular-nums">
                  {formatCent(daten.ustva.kz81_steuer_cent + daten.ustva.kz86_steuer_cent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vorsteuer</span>
                <span className="tabular-nums">−{formatCent(daten.ustva.kz66_vorsteuer_cent)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-2 font-medium">
                <span>{k.ust_zahllast_cent >= 0 ? "Zahllast" : "Erstattung"}</span>
                <span className={`tabular-nums ${k.ust_zahllast_cent > 0 ? "text-rust" : "text-primary"}`}>
                  {formatCent(Math.abs(k.ust_zahllast_cent))}
                </span>
              </div>
              <Link href="/buchhaltung/auswertungen"
                className="mt-1 text-xs text-muted-foreground hover:text-foreground">
                Voranmeldung ansehen →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zu erledigen</CardTitle>
              <p className="text-sm text-muted-foreground">
                {zuErledigen === 0 ? "Alles abgearbeitet" : `${zuErledigen} offene Vorgänge`}
              </p>
            </CardHeader>
            <CardContent className="grid gap-2">
              {zuErledigen === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nichts offen — sauber.
                </p>
              ) : (
                <>
                  {vorrat.offeneBelege.length > 0 && (
                    <Link href="/buchhaltung/belege"
                      className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-muted">
                      <span>Belege verbuchen</span>
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold-ink">
                        {vorrat.offeneBelege.length}
                      </span>
                    </Link>
                  )}
                  {vorrat.offeneBankUmsaetze.length > 0 && (
                    <Link href="/buchhaltung/bank"
                      className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-muted">
                      <span>Bankumsätze zuordnen</span>
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold-ink">
                        {vorrat.offeneBankUmsaetze.length}
                      </span>
                    </Link>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
