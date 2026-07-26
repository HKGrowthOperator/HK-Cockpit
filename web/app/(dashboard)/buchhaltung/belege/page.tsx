import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BelegUpload } from "@/components/buchhaltung/beleg-upload";
import { ladeBelege } from "@/lib/accounting/db";
import { formatCent } from "@/lib/accounting/buchen";

export const dynamic = "force-dynamic";

const QUELLE_LABEL: Record<string, string> = {
  upload: "Upload", email: "E-Mail", drive: "Google Drive", bank: "Bank", manuell: "manuell",
};
const TYP_LABEL: Record<string, string> = {
  eingangsrechnung: "Eingangsrechnung", ausgangsrechnung: "Ausgangsrechnung",
  quittung: "Quittung", kontoauszug: "Kontoauszug", sonstiges: "Sonstiges",
};

export default async function Page() {
  const [offen, alle] = await Promise.all([ladeBelege("offen", 100), ladeBelege(undefined, 200)]);
  const erledigt = alle.filter((b) => b.status !== "offen");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Belege</h1>
          <p className="text-sm text-muted-foreground">
            {offen.length} offen · {erledigt.length} erledigt
          </p>
        </div>
        <Link href="/buchhaltung" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Übersicht
        </Link>
      </div>

      <BelegUpload />

      <Card>
        <CardHeader>
          <CardTitle>Offene Belege</CardTitle>
        </CardHeader>
        <CardContent>
          {offen.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine offenen Belege. Neue Belege kommen per Upload, E-Mail, Drive oder Bank herein.
            </p>
          ) : (
            <div className="grid gap-2">
              {offen.map((b) => (
                <div key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{b.belegnummer}</span>{" "}
                      {b.partner ?? b.beschreibung ?? b.datei_name ?? "Ohne Bezeichnung"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {TYP_LABEL[b.typ] ?? b.typ} · {QUELLE_LABEL[b.quelle] ?? b.quelle}
                      {b.datum && ` · ${b.datum.split("-").reverse().join(".")}`}
                      {b.betrag_cent != null && ` · ${formatCent(b.betrag_cent)}`}
                    </div>
                  </div>
                  <Link href={`/buchhaltung/buchungen?beleg=${b.id}`}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                    Verbuchen
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {erledigt.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Erledigt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 text-sm">
              {erledigt.slice(0, 50).map((b) => (
                <div key={b.id} className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-muted-foreground">{b.belegnummer}</span>{" "}
                    {b.partner ?? b.beschreibung ?? b.datei_name}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {b.betrag_cent != null ? formatCent(b.betrag_cent) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
