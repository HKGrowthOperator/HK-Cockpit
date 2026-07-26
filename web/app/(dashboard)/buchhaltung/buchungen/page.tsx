import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuchungFormular } from "@/components/buchhaltung/buchung-formular";
import { ladeBuchungen, ladeKonten, ladeEinstellungen } from "@/lib/accounting/db";
import { formatCent } from "@/lib/accounting/buchen";
import { STEUER_LABEL } from "@/lib/accounting/types";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string; beleg?: string }>;
}) {
  const p = await searchParams;
  const jahr = Number(p.jahr) || new Date().getFullYear();

  const [buchungen, konten, einstellungen] = await Promise.all([
    ladeBuchungen({ jahr, limit: 300 }),
    ladeKonten(),
    ladeEinstellungen(),
  ]);
  const kontoName = new Map(konten.map((k) => [k.nummer, k.bezeichnung]));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Buchungen {jahr}</h1>
          <p className="text-sm text-muted-foreground">{buchungen.length} Buchungssätze</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/buchhaltung" className="rounded-md border border-border px-3 py-1.5">
            Übersicht
          </Link>
          <a href={`/api/buchhaltung/export?jahr=${jahr}&format=datev`}
            className="rounded-md border border-border px-3 py-1.5">
            DATEV-Export
          </a>
          <a href={`/api/buchhaltung/export?jahr=${jahr}&format=csv`}
            className="rounded-md border border-border px-3 py-1.5">
            CSV
          </a>
        </div>
      </div>

      <BuchungFormular konten={konten} rahmen={einstellungen.kontenrahmen} belegId={p.beleg} />

      <Card>
        <CardHeader>
          <CardTitle>Journal</CardTitle>
        </CardHeader>
        <CardContent>
          {buchungen.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Buchungen in {jahr}. Die erste erfasst du oben.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Nr.</th>
                    <th className="py-2 pr-3 font-medium">Datum</th>
                    <th className="py-2 pr-3 font-medium">Text</th>
                    <th className="py-2 pr-3 font-medium">Soll</th>
                    <th className="py-2 pr-3 font-medium">Haben</th>
                    <th className="py-2 pr-3 font-medium">Steuer</th>
                    <th className="py-2 pr-3 text-right font-medium">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {buchungen.map((b) => (
                    <tr key={b.id}
                      className={`border-b border-border/50 ${b.status === "storniert" ? "text-muted-foreground line-through" : ""}`}>
                      <td className="py-2 pr-3 font-mono text-xs">{b.buchungsnummer}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {b.datum.split("-").reverse().join(".")}
                      </td>
                      <td className="py-2 pr-3">{b.buchungstext}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="font-mono text-xs">{b.soll_konto}</span>{" "}
                        <span className="text-muted-foreground">{kontoName.get(b.soll_konto)}</span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="font-mono text-xs">{b.haben_konto}</span>{" "}
                        <span className="text-muted-foreground">{kontoName.get(b.haben_konto)}</span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {STEUER_LABEL[b.steuerschluessel]}
                        {b.steuer_cent > 0 && ` (${formatCent(b.steuer_cent)})`}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">
                        {formatCent(b.betrag_cent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
