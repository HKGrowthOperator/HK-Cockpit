"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Zustand =
  | { art: "bereit" }
  | { art: "laeuft" }
  | { art: "ok" }
  | { art: "fehler"; text: string; hinweis?: string };

/** „Jetzt starten" für eine Automation. Ruft /api/automations/run, das den
 *  n8n-Webhook des Workflows auslöst und den Lauf protokolliert. */
export function AutomationStart({
  automationId,
  titel,
}: {
  automationId: string;
  titel: string;
}) {
  const router = useRouter();
  const [zustand, setZustand] = useState<Zustand>({ art: "bereit" });

  async function starten() {
    setZustand({ art: "laeuft" });
    try {
      const res = await fetch("/api/automations/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: automationId, titel }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setZustand({ art: "fehler", text: d.error ?? "Start fehlgeschlagen.", hinweis: d.hinweis });
        return;
      }
      setZustand({ art: "ok" });
      router.refresh(); // Lauf erscheint in der Übersicht
      setTimeout(() => setZustand({ art: "bereit" }), 4000);
    } catch {
      setZustand({ art: "fehler", text: "Das Cockpit konnte die Anfrage nicht senden." });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={starten}
        disabled={zustand.art === "laeuft"}
        className={
          zustand.art === "ok"
            ? "rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
            : "bg-primary text-primary-foreground hover:opacity-90 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        }
      >
        {zustand.art === "laeuft" && "Startet …"}
        {zustand.art === "ok" && "✓ Gestartet"}
        {(zustand.art === "bereit" || zustand.art === "fehler") && "Jetzt starten"}
      </button>

      {zustand.art === "fehler" && (
        <span className="text-rust max-w-[220px] text-[11px] leading-snug">
          {zustand.text}
          {zustand.hinweis && <span className="text-muted-foreground block">{zustand.hinweis}</span>}
        </span>
      )}
    </div>
  );
}
