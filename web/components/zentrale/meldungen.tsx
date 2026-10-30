"use client";
// Kurze Rückmeldungen unten rechts. Bleiben sichtbar, auch wenn der Knopf,
// der sie ausgelöst hat, nach dem Neuladen der Liste verschwindet.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type M = { id: number; ok: boolean; meldung: string };

export function meldeAntwort(a: { ok: boolean; meldung: string }) {
  window.dispatchEvent(new CustomEvent("zentrale:meldung", { detail: a }));
}

export function Meldungen() {
  const [liste, setListe] = useState<M[]>([]);
  useEffect(() => {
    let n = 0;
    const neu = (e: Event) => {
      const d = (e as CustomEvent<{ ok: boolean; meldung: string }>).detail;
      const id = ++n;
      setListe((l) => [...l.slice(-2), { id, ...d }]);
      setTimeout(() => setListe((l) => l.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener("zentrale:meldung", neu);
    return () => window.removeEventListener("zentrale:meldung", neu);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2">
      {liste.map((m) => (
        <p key={m.id} className={cn("bg-card rounded-lg border px-4 py-2.5 text-sm shadow-lg",
          m.ok ? "border-moss/50 text-foreground" : "border-rust/50 text-rust")}>
          {m.meldung}
        </p>
      ))}
    </div>
  );
}
