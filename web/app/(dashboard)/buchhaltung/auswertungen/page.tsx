import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ladeJahresdaten } from "@/lib/accounting/laden";
import { formatCent } from "@/lib/accounting/buchen";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string; zeitraum?: string }>;
}) {
  const p = await searchParams;
  const jahr = Number(p.jahr) || new Date().getFullYear();
  const daten = await ladeJahresdaten(jahr, p.zeitraum);
  const { guv, susa, ustva } = daten;

  const monate = Array.from({ length: 12 }, (_, i) => `${jahr}-${String(i + 1).padStart(2, "0")}`);
  const quartale = ["Q1", "Q2", "Q3", "Q4"].map((q) => `${jahr}-${q}`);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Auswertungen {jahr}</h1>
          <p className="text-sm text-muted-foreground">
            GuV, Summen- und Saldenliste, Umsatzsteuer-Voranmeldung
          </p>
        </div>
        <Link href="/buchhaltung" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Übersicht
        </Link>
      </div>

      {/* ── Gewinn- und Verlustrechnung ── */}
      <Card>
        <CardHeader>
          <CardTitle>Gewinn- und Verlustrechnung</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {guv.ertraege.length === 0 && guv.aufwendungen.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Buchungen — sobald gebucht wird, steht hier die GuV.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Erträge" value={formatCent(guv.summe_ertraege_cent)} tone="good" />
                <StatCard label="Aufwendungen" value={formatCent(guv.summe_aufwendungen_cent)} />
                <StatCard label="Ergebnis" value={formatCent(guv.ergebnis_cent)}
                  hint={guv.ergebnis_cent >= 0 ? "Gewinn" : "Verlust"}
                  tone={guv.ergebnis_cent >= 0 ? "good" : "bad"} />
              </div>

              {[
                { titel: "Erträge", gruppen: guv.ertraege },
                { titel: "Aufwendungen", gruppen: guv.aufwendungen },
              ].map(({ titel, gruppen }) =>
                gruppen.length ? (
                  <div key={titel}>
                    <h3 className="mb-2 text-sm font-semibold">{titel}</h3>
                    <div className="grid gap-1 text-sm">
                      {gruppen.map((g) => (
                        <details key={g.gruppe} className="rounded-md border border-border">
                          <summary className="flex cursor-pointer justify-between px-3 py-2">
                            <span>{g.gruppe}</span>
                            <span className="font-medium">{formatCent(g.betrag_cent)}</span>
                          </summary>
                          <div className="border-t border-border/50 px-3 py-2">
                            {g.konten.map((k) => (
                              <div key={k.konto} className="flex justify-between py-0.5 text-muted-foreground">
                                <span>
                                  <span className="font-mono text-xs">{k.konto}</span> {k.bezeichnung}
                                </span>
                                <span>{formatCent(k.saldo_cent)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Umsatzsteuer-Voranmeldung ── */}
      <Card>
        <CardHeader>
          <CardTitle>Umsatzsteuer-Voranmeldung · {ustva.zeitraum}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-1 text-xs">
            {[...monate, ...quartale].map((z) => (
              <Link key={z} href={`/buchhaltung/auswertungen?jahr=${jahr}&zeitraum=${z}`}
                className={`rounded border px-2 py-1 ${
                  z === ustva.zeitraum ? "border-primary bg-primary/10 font-medium" : "border-border"
                }`}>
                {z.slice(5)}
              </Link>
            ))}
          </div>

          <div className="grid gap-1 text-sm">
            {[
              ["Kz 81 · Umsätze 19 % (netto)", ustva.kz81_netto_19_cent],
              ["Kz 81 · darauf Umsatzsteuer", ustva.kz81_steuer_cent],
              ["Kz 86 · Umsätze 7 % (netto)", ustva.kz86_netto_7_cent],
              ["Kz 86 · darauf Umsatzsteuer", ustva.kz86_steuer_cent],
              ["Kz 61 · Steuer auf EU-Erwerb", ustva.kz61_igerwerb_cent],
              ["Kz 67 · Steuer nach § 13b", ustva.kz67_13b_cent],
              ["Kz 66 · abziehbare Vorsteuer", -ustva.kz66_vorsteuer_cent],
            ].map(([label, wert]) => (
              <div key={String(label)} className="flex justify-between border-b border-border/50 py-1.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{formatCent(Number(wert))}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-semibold">
              <span>{ustva.zahllast_cent >= 0 ? "Zahllast ans Finanzamt" : "Erstattung"}</span>
              <span className={ustva.zahllast_cent > 0 ? "text-rust" : "text-primary"}>
                {formatCent(Math.abs(ustva.zahllast_cent))}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ermittelt aus den erfassten Buchungen. Die amtliche Anmeldung erfolgt über ELSTER
            oder den Steuerberater — diese Übersicht dient der Vorbereitung und Kontrolle.
          </p>
        </CardContent>
      </Card>

      {/* ── Summen- und Saldenliste ── */}
      <Card>
        <CardHeader>
          <CardTitle>Summen- und Saldenliste</CardTitle>
        </CardHeader>
        <CardContent>
          {susa.zeilen.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Noch keine bebuchten Konten.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Konto</th>
                      <th className="py-2 pr-3 font-medium">Bezeichnung</th>
                      <th className="py-2 pr-3 text-right font-medium">Soll</th>
                      <th className="py-2 pr-3 text-right font-medium">Haben</th>
                      <th className="py-2 pr-3 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {susa.zeilen.map((z) => (
                      <tr key={z.konto} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 font-mono text-xs">{z.konto}</td>
                        <td className="py-1.5 pr-3">{z.bezeichnung}</td>
                        <td className="py-1.5 pr-3 text-right">{formatCent(z.soll_cent)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatCent(z.haben_cent)}</td>
                        <td className="py-1.5 pr-3 text-right font-medium">{formatCent(z.saldo_cent)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="py-2 pr-3" colSpan={2}>Summe</td>
                      <td className="py-2 pr-3 text-right">{formatCent(susa.summe_soll_cent)}</td>
                      <td className="py-2 pr-3 text-right">{formatCent(susa.summe_haben_cent)}</td>
                      <td className="py-2 pr-3 text-right">
                        {susa.differenz_cent === 0 ? "ausgeglichen" : formatCent(susa.differenz_cent)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {susa.differenz_cent !== 0 && (
                <p className="mt-3 text-sm text-rust">
                  Soll und Haben stimmen nicht überein (Differenz {formatCent(susa.differenz_cent)}).
                  Das deutet auf eine fehlerhafte Buchung hin.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
