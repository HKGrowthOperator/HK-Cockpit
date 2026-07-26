"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SCHNELLVORGANG_LABEL, kontierung, type Schnellvorgang } from "@/lib/accounting/buchen";
import { STEUER_LABEL, type Konto, type Kontenrahmen, type Steuerschluessel } from "@/lib/accounting/types";

/** Erfassungsmaske: Der Nutzer wählt den Vorgang in Alltagssprache,
 *  der korrekte Buchungssatz (Soll/Haben) wird daraus gebildet und angezeigt. */
export function BuchungFormular({
  konten,
  rahmen,
  belegId,
  vorbelegung,
}: {
  konten: Konto[];
  rahmen: Kontenrahmen;
  belegId?: string;
  vorbelegung?: { datum?: string; text?: string; betrag?: string; konto?: string };
}) {
  const router = useRouter();
  const [vorgang, setVorgang] = useState<Schnellvorgang>("barausgabe");
  const [datum, setDatum] = useState(vorbelegung?.datum ?? new Date().toISOString().slice(0, 10));
  const [text, setText] = useState(vorbelegung?.text ?? "");
  const [betrag, setBetrag] = useState(vorbelegung?.betrag ?? "");
  const [gegenkonto, setGegenkonto] = useState(vorbelegung?.konto ?? "");
  const [steuer, setSteuer] = useState<Steuerschluessel>("19");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  // Je nach Vorgang sind Erlös- oder Aufwandskonten sinnvoll.
  const auswahl = useMemo(() => {
    const istEinnahme = vorgang === "ausgangsrechnung" || vorgang === "bareinnahme";
    return konten
      .filter((k) => (istEinnahme ? k.art === "ertrag" : k.art === "aufwand"))
      .sort((a, b) => a.gruppe.localeCompare(b.gruppe) || a.nummer.localeCompare(b.nummer));
  }, [konten, vorgang]);

  const zahlung = vorgang === "zahlungseingang" || vorgang === "zahlungsausgang";
  const gewaehlt = konten.find((k) => k.nummer === gegenkonto);
  const satz = kontierung(vorgang, rahmen, gegenkonto || "—");
  const sollKonto = konten.find((k) => k.nummer === satz.soll);
  const habenKonto = konten.find((k) => k.nummer === satz.haben);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setMeldung(null);
    if (!zahlung && !gegenkonto) {
      setMeldung({ art: "fehler", text: "Bitte ein Konto auswählen." });
      return;
    }
    setLaeuft(true);
    try {
      const res = await fetch("/api/buchhaltung/buchungen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          datum, buchungstext: text, betrag,
          steuerschluessel: zahlung ? "0" : steuer, // Zahlungen sind steuerneutral
          soll_konto: satz.soll, haben_konto: satz.haben,
          beleg_id: belegId ?? null,
        }),
      });
      const daten = await res.json();
      if (!res.ok) throw new Error(daten.error ?? "Buchung fehlgeschlagen.");
      setMeldung({ art: "ok", text: `Gebucht als ${daten.buchung.buchungsnummer}.` });
      setText(""); setBetrag("");
      router.refresh();
    } catch (err) {
      setMeldung({ art: "fehler", text: err instanceof Error ? err.message : "Fehler." });
    } finally {
      setLaeuft(false);
    }
  }

  const feld = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buchung erfassen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={absenden} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Was ist passiert?</span>
            <select className={feld} value={vorgang}
              onChange={(e) => setVorgang(e.target.value as Schnellvorgang)}>
              {Object.entries(SCHNELLVORGANG_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Datum</span>
            <input className={feld} type="date" value={datum} required
              onChange={(e) => setDatum(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Betrag (brutto)</span>
            <input className={feld} inputMode="decimal" placeholder="z. B. 119,00" value={betrag}
              required onChange={(e) => setBetrag(e.target.value)} />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Buchungstext</span>
            <input className={feld} placeholder="z. B. Hosting Juli, Rechnung 2026-042"
              value={text} required onChange={(e) => setText(e.target.value)} />
          </label>

          {!zahlung && (
            <>
              <label className="grid gap-1">
                <span className="text-sm font-medium">
                  {vorgang === "ausgangsrechnung" || vorgang === "bareinnahme" ? "Erlöskonto" : "Kostenart"}
                </span>
                <select className={feld} value={gegenkonto} required
                  onChange={(e) => {
                    setGegenkonto(e.target.value);
                    const k = konten.find((x) => x.nummer === e.target.value);
                    if (k?.steuer) setSteuer(k.steuer); // Steuerschlüssel folgt dem Konto
                  }}>
                  <option value="">— bitte wählen —</option>
                  {auswahl.map((k) => (
                    <option key={k.nummer} value={k.nummer}>
                      {k.gruppe} · {k.nummer} {k.bezeichnung}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium">Umsatzsteuer</span>
                <select className={feld} value={steuer}
                  onChange={(e) => setSteuer(e.target.value as Steuerschluessel)}>
                  {(Object.keys(STEUER_LABEL) as Steuerschluessel[]).map((s) => (
                    <option key={s} value={s}>{STEUER_LABEL[s]}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {/* Der gebildete Buchungssatz — nachvollziehbar statt Blackbox. */}
          <div className="sm:col-span-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium mb-1">Buchungssatz</div>
            <div className="text-muted-foreground">
              <span className="font-mono">{satz.soll}</span>{" "}
              {sollKonto?.bezeichnung ?? (gewaehlt?.bezeichnung ?? "—")}
              {" "}<span className="mx-1">an</span>{" "}
              <span className="font-mono">{satz.haben}</span>{" "}
              {habenKonto?.bezeichnung ?? (gewaehlt?.bezeichnung ?? "—")}
            </div>
          </div>

          {meldung && (
            <p className={`sm:col-span-2 text-sm ${meldung.art === "ok" ? "text-primary" : "text-rust"}`}>
              {meldung.text}
            </p>
          )}

          <div className="sm:col-span-2">
            <button type="submit" disabled={laeuft}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {laeuft ? "Wird gebucht …" : "Buchen"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
