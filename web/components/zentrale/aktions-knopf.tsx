"use client";
// Ein Knopf für eine einzelne Aktion (Freigeben, Verwerfen, Prüfen …) mit
// Rückmeldung direkt daneben.
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Antwort } from "@/lib/zentrale/aktionen";
import { knopfKlasse } from "./stil";
import { meldeAntwort } from "./meldungen";

export function AktionsKnopf({
  aktion, children, variante = "zweit", frage, className, zeigeWert = false,
}: {
  aktion: () => Promise<Antwort>;
  children: React.ReactNode;
  variante?: "primaer" | "zweit" | "leise" | "gefahr";
  frage?: string;
  className?: string;
  zeigeWert?: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={laeuft}
        className={cn(knopfKlasse(variante), laeuft && "opacity-60", className)}
        onClick={() => {
          if (frage && !window.confirm(frage)) return;
          starte(async () => {
            const a = await aktion();
            setAntwort(a);
            meldeAntwort(a);
          });
        }}>
        {children}
      </button>
      {antwort && (
        <span role="status" className={cn("text-xs", antwort.ok ? "text-moss" : "text-rust")}>
          {antwort.meldung}
        </span>
      )}
      {zeigeWert && antwort?.wert && (
        <code className="bg-accent block w-full rounded px-2 py-1.5 text-xs break-all select-all">{antwort.wert}</code>
      )}
    </span>
  );
}
