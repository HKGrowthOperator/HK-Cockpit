"use client";
// Befehlspalette (Strg/⌘ + K): jede Seite, jede App, jeder Direktsprung in
// eine App und die häufigsten Handgriffe — über die Tastatur erreichbar.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type PalettenEintrag = {
  gruppe: string;
  label: string;
  href: string;
  extern?: boolean;
  zusatz?: string;
};

function normal(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
}

export function Befehlspalette({ eintraege }: { eintraege: PalettenEintrag[] }) {
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const [aktiv, setAktiv] = useState(0);
  const eingabe = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const router = useRouter();

  const offenRef = useRef(false);
  useEffect(() => { offenRef.current = offen; }, [offen]);

  useEffect(() => {
    const oeffnen = () => {
      setSuche("");
      setAktiv(0);
      setOffen(true);
    };
    const taste = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (offenRef.current) setOffen(false);
        else oeffnen();
      }
    };
    window.addEventListener("keydown", taste);
    window.addEventListener("befehlspalette:oeffnen", oeffnen);
    return () => {
      window.removeEventListener("keydown", taste);
      window.removeEventListener("befehlspalette:oeffnen", oeffnen);
    };
  }, []);

  const treffer = useMemo(() => {
    const woerter = normal(suche).split(/\s+/).filter(Boolean);
    if (!woerter.length) return eintraege.slice(0, 40);
    return eintraege
      .map((e) => {
        const text = normal(`${e.label} ${e.gruppe} ${e.zusatz ?? ""}`);
        if (!woerter.every((w) => text.includes(w))) return null;
        const start = normal(e.label).startsWith(woerter[0]) ? 0 : 1;
        return { e, rang: start };
      })
      .filter((x): x is { e: PalettenEintrag; rang: number } => x !== null)
      .sort((a, b) => a.rang - b.rang)
      .map((x) => x.e)
      .slice(0, 40);
  }, [suche, eintraege]);

  useEffect(() => {
    liste.current?.querySelector<HTMLElement>(`[data-index="${aktiv}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aktiv]);

  function waehle(e: PalettenEintrag | undefined) {
    if (!e) return;
    setOffen(false);
    if (e.extern) window.open(e.href, "_blank", "noopener,noreferrer");
    else router.push(e.href);
  }

  if (!offen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#2e3a2a]/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOffen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Befehlspalette"
        className="bg-card border-border w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl">
        <input
          ref={eingabe}
          autoFocus
          value={suche}
          onChange={(e) => { setSuche(e.target.value); setAktiv(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOffen(false);
            else if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((a) => Math.min(a + 1, treffer.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); waehle(treffer[aktiv]); }
          }}
          placeholder="Wohin? App, Seite oder Handgriff …"
          aria-label="Suchen"
          role="combobox"
          aria-expanded="true"
          aria-controls="paletten-liste"
          className="border-border w-full border-b bg-transparent px-4 py-3.5 text-base outline-none"
        />
        <ul ref={liste} id="paletten-liste" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {treffer.length === 0 && (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">Nichts gefunden. Versuch es mit dem Namen einer App.</li>
          )}
          {treffer.map((e, i) => {
            const kopf = i === 0 || treffer[i - 1].gruppe !== e.gruppe ? e.gruppe : null;
            return (
              <li key={`${e.gruppe}-${e.href}-${e.label}`}>
                {kopf && <p className="text-muted-foreground px-3 pt-2.5 pb-1 text-xs">{kopf}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === aktiv}
                  data-index={i}
                  onMouseEnter={() => setAktiv(i)}
                  onClick={() => waehle(e)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                    i === aktiv ? "bg-accent text-foreground" : "text-foreground/85",
                  )}
                >
                  <span className="flex-1 truncate">{e.label}</span>
                  {e.zusatz && <span className="text-muted-foreground truncate text-xs">{e.zusatz}</span>}
                  {e.extern && <span className="text-muted-foreground text-xs" aria-label="öffnet neuen Tab">↗</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground border-border flex gap-5 border-t px-4 py-2 text-xs">
          <span>↑ ↓ wählen</span><span>Enter öffnen</span><span>Esc schließen</span>
        </p>
      </div>
    </div>
  );
}

export function PalettenKnopf() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("befehlspalette:oeffnen"))}
      className="border-border bg-card text-muted-foreground hover:border-gold hidden items-center gap-3 rounded-md border px-3 py-1.5 text-sm sm:flex"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      Springen zu …
      <kbd className="border-border rounded border px-1.5 text-[11px]">Strg K</kbd>
    </button>
  );
}
