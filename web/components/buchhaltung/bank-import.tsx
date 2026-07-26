"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCent } from "@/lib/accounting/buchen";

type Vorschlag = {
  umsatz_id: string;
  rechnung: { id: string; invoice_id: string; company: string; customer_name: string; amount_cent: number };
  sicherheit: number;
  grund: string;
};

/** Kontoauszug einlesen und die vorgeschlagenen Zuordnungen bestätigen. */
export function BankImport({ vorschlaege: initial }: { vorschlaege: Vorschlag[] }) {
  const router = useRouter();
  const [vorschlaege, setVorschlaege] = useState(initial);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  async function importieren(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datei = new FormData(e.currentTarget).get("datei");
    if (!(datei instanceof File) || !datei.size) return;
    setLaeuft(true);
    setMeldung(null);
    try {
      const form = new FormData();
      form.set("datei", datei);
      const res = await fetch("/api/buchhaltung/bank-import", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Import fehlgeschlagen.");
      setVorschlaege(d.vorschlaege ?? []);
      setMeldung({
        art: "ok",
        text: `${d.neu} neue Umsätze übernommen${d.duplikate ? `, ${d.duplikate} bereits bekannt` : ""}${
          d.uebersprungen ? `, ${d.uebersprungen} Zeilen ohne Betrag übersprungen` : ""
        }.`,
      });
      router.refresh();
    } catch (err) {
      setMeldung({ art: "fehler", text: err instanceof Error ? err.message : "Fehler." });
    } finally {
      setLaeuft(false);
    }
  }

  async function entscheiden(v: Vorschlag, status: "zugeordnet" | "ignoriert") {
    await fetch("/api/buchhaltung/bank-import", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        umsatz_id: v.umsatz_id,
        rechnung_id: status === "zugeordnet" ? v.rechnung.id : null,
        status,
      }),
    });
    setVorschlaege((alt) => alt.filter((x) => x.umsatz_id !== v.umsatz_id));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontoauszug einlesen</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={importieren} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-1">
            <span className="text-sm font-medium">CSV aus dem Online-Banking</span>
            <input name="datei" type="file" accept=".csv,text/csv" required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <span className="text-xs text-muted-foreground">
              Sparkasse, Volksbank, DKB, N26, Commerzbank … — Spalten werden automatisch erkannt.
            </span>
          </label>
          <button type="submit" disabled={laeuft}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {laeuft ? "Liest …" : "Einlesen"}
          </button>
        </form>

        {meldung && (
          <p className={`text-sm ${meldung.art === "ok" ? "text-primary" : "text-rust"}`}>{meldung.text}</p>
        )}

        {vorschlaege.length > 0 && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">Vorgeschlagene Zuordnungen</div>
            {vorschlaege.map((v) => (
              <div key={v.umsatz_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {v.rechnung.invoice_id} · {v.rechnung.company || v.rechnung.customer_name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatCent(v.rechnung.amount_cent)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.grund} (Sicherheit {v.sicherheit} %)
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => entscheiden(v, "zugeordnet")}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                    Passt
                  </button>
                  <button onClick={() => entscheiden(v, "ignoriert")}
                    className="rounded-md border border-border px-3 py-1.5 text-sm">
                    Ignorieren
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
