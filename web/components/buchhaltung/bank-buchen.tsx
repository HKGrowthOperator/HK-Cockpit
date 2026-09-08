"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Konfidenz = "hoch" | "mittel" | "zu_pruefen";

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

const KONFIDENZ_LABEL: Record<Konfidenz, string> = {
  hoch: "sicher",
  mittel: "wahrscheinlich",
  zu_pruefen: "zu prüfen",
};

const KONFIDENZ_STIL: Record<Konfidenz, string> = {
  hoch: "bg-primary/10 text-primary",
  mittel: "bg-muted text-foreground",
  zu_pruefen: "bg-rust/10 text-rust",
};

/**
 * Bucht die offenen Bankumsätze in einem Durchgang.
 *
 * Bewusst zweistufig: erst die Vorschau, die nichts schreibt, dann das Buchen.
 * Wer 71 Zeilen auf einmal ins Journal schreibt, will vorher sehen, wohin.
 */
export function BankBuchen({ offen }: { offen: number }) {
  const router = useRouter();
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  async function vorschau() {
    setLaeuft(true);
    setMeldung(null);
    try {
      const res = await fetch("/api/buchhaltung/bank-buchen");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Vorschau fehlgeschlagen.");
      setZeilen(d.zeilen ?? []);
    } catch (err) {
      setMeldung({ art: "fehler", text: err instanceof Error ? err.message : "Fehler." });
    } finally {
      setLaeuft(false);
    }
  }

  async function buchen() {
    setLaeuft(true);
    setMeldung(null);
    try {
      const res = await fetch("/api/buchhaltung/bank-buchen", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Buchen fehlgeschlagen.");
      const z = d.zusammenfassung ?? {};
      setMeldung({
        art: "ok",
        text:
          `${d.gebucht} Umsätze gebucht` +
          (z.zu_pruefen ? `, davon ${z.zu_pruefen} zum Prüfen markiert` : "") +
          (d.uebersprungen ? `. ${d.uebersprungen} übersprungen — siehe unten.` : "."),
      });
      if (Array.isArray(d.fehler) && d.fehler.length) {
        setMeldung((m) => (m ? { ...m, text: `${m.text} ${d.fehler.join(" · ")}` } : m));
      }
      setZeilen(null);
      router.refresh();
    } catch (err) {
      setMeldung({ art: "fehler", text: err instanceof Error ? err.message : "Fehler." });
    } finally {
      setLaeuft(false);
    }
  }

  const zuPruefen = zeilen?.filter((z) => z.konfidenz === "zu_pruefen").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Umsätze verbuchen</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Aus jedem offenen Umsatz wird eine Buchung. Das Gegenkonto schlägt das
          Cockpit anhand von Partner und Verwendungszweck vor. Was sich nicht
          sicher zuordnen lässt, geht auf <strong>1590 Noch zu klären</strong> —
          dort fällt es beim Durchsehen auf, statt still die GuV zu verfälschen.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={vorschau}
            disabled={laeuft || offen === 0}
            className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {laeuft && !zeilen ? "Wird geprüft …" : "Vorschau ansehen"}
          </button>
          <button
            type="button"
            onClick={buchen}
            disabled={laeuft || offen === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {laeuft && zeilen ? "Wird gebucht …" : `${offen} Umsätze buchen`}
          </button>
          {zeilen !== null && (
            <span className="text-sm text-muted-foreground">
              {zeilen.length} Vorschläge{zuPruefen ? `, ${zuPruefen} davon zu prüfen` : ""}
            </span>
          )}
        </div>

        {meldung && (
          <p className={`text-sm ${meldung.art === "ok" ? "text-primary" : "text-rust"}`}>
            {meldung.text}
          </p>
        )}

        {zeilen !== null && zeilen.length > 0 && (
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Buchungstext</th>
                  <th className="px-3 py-2 font-medium">Soll</th>
                  <th className="px-3 py-2 font-medium">Haben</th>
                  <th className="px-3 py-2 font-medium">USt</th>
                  <th className="px-3 py-2 text-right font-medium">Betrag</th>
                  <th className="px-3 py-2 font-medium">Sicherheit</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z) => (
                  <tr key={z.umsatz_id} className="border-b border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {z.datum.split("-").reverse().join(".")}
                    </td>
                    <td className="px-3 py-2">{z.buchungstext.slice(0, 60)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{z.soll_konto}</td>
                    <td className="px-3 py-2 font-mono text-xs">{z.haben_konto}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {z.steuerschluessel === "0" ? "—" : `${z.steuerschluessel} %`}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{z.betrag}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${KONFIDENZ_STIL[z.konfidenz]}`}
                        title={`Regel: ${z.regel}`}
                      >
                        {KONFIDENZ_LABEL[z.konfidenz]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
