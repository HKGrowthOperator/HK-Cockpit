"use client";
// Formular für Server-Aktionen: zeigt die Antwort der Aktion direkt an und
// sperrt den Knopf, solange sie läuft. Eingaben bleiben bei einem Fehler
// stehen (React setzt <form action> sonst immer zurück).
import { createContext, useContext, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Antwort } from "@/lib/zentrale/aktionen";
import { knopfKlasse } from "./stil";


type Aktion = (prev: Antwort | null, fd: FormData) => Promise<Antwort>;

const Laeuft = createContext(false);

export function Formular({
  aktion, children, className, zuruecksetzen = false,
}: { aktion: Aktion; children: React.ReactNode; className?: string; zuruecksetzen?: boolean }) {
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [laeuft, starte] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        starte(async () => {
          const a = await aktion(antwort, fd);
          setAntwort(a);
          if (a.ok && zuruecksetzen) form.current?.reset();
        });
      }}
    >
      <Laeuft.Provider value={laeuft}>{children}</Laeuft.Provider>
      <Meldung antwort={antwort} />
    </form>
  );
}

export function Meldung({ antwort }: { antwort: Antwort | null }) {
  if (!antwort) return null;
  return (
    <p role="status" className={cn("mt-3 text-sm", antwort.ok ? "text-moss" : "text-rust")}>
      {antwort.meldung}
    </p>
  );
}

export function Senden({ children, name, value, variante = "primaer", className }: {
  children: React.ReactNode; name?: string; value?: string; variante?: "primaer" | "zweit"; className?: string;
}) {
  const pending = useContext(Laeuft);
  return (
    <button type="submit" name={name} value={value} disabled={pending}
      className={cn(knopfKlasse(variante), pending && "opacity-60", className)}>
      {children}
    </button>
  );
}

export function Feld({ label, hinweis, children }: { label: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hinweis ? <span className="text-muted-foreground text-xs">{hinweis}</span> : null}
    </label>
  );
}
