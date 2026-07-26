"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Beleg hochladen (PDF/Foto). Landet in der Belegliste mit Status "offen". */
export function BelegUpload() {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);
  const [ueberZiel, setUeberZiel] = useState(false);

  async function hochladen(datei: File, typ: string) {
    setLaeuft(true);
    setMeldung(null);
    try {
      const form = new FormData();
      form.set("datei", datei);
      form.set("typ", typ);
      const res = await fetch("/api/buchhaltung/belege", { method: "POST", body: form });
      const daten = await res.json();
      if (!res.ok) throw new Error(daten.error ?? "Upload fehlgeschlagen.");
      setMeldung({ art: "ok", text: `${datei.name} übernommen als ${daten.beleg.belegnummer}.` });
      router.refresh();
    } catch (err) {
      setMeldung({ art: "fehler", text: err instanceof Error ? err.message : "Fehler." });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beleg hinzufügen</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const datei = f.get("datei");
            if (datei instanceof File && datei.size) hochladen(datei, String(f.get("typ")));
          }}
          className="grid gap-3"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setUeberZiel(true); }}
            onDragLeave={() => setUeberZiel(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUeberZiel(false);
              const datei = e.dataTransfer.files?.[0];
              if (datei) hochladen(datei, "eingangsrechnung");
            }}
            className={`rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors ${
              ueberZiel ? "border-primary bg-primary/5" : "border-border text-muted-foreground"
            }`}
          >
            Datei hierher ziehen — oder unten auswählen.
            <div className="mt-1 text-xs">PDF, Foto, CSV oder Excel · max. 25 MB</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Datei</span>
              <input name="datei" type="file" required
                accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.csv,.xls,.xlsx"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Art</span>
              <select name="typ" defaultValue="eingangsrechnung"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="eingangsrechnung">Eingangsrechnung</option>
                <option value="ausgangsrechnung">Ausgangsrechnung</option>
                <option value="quittung">Quittung / Bon</option>
                <option value="kontoauszug">Kontoauszug</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </label>

            <button type="submit" disabled={laeuft}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {laeuft ? "Lädt …" : "Hochladen"}
            </button>
          </div>

          {meldung && (
            <p className={`text-sm ${meldung.art === "ok" ? "text-primary" : "text-rust"}`}>
              {meldung.text}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
