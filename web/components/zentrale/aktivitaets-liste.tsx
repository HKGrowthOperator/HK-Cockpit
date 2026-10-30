import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Aktivitaet } from "@/lib/zentrale/lage";
import { seit, datumZeit } from "./zeit";

const ART_FARBE: Record<Aktivitaet["art"], string> = {
  ereignis: "bg-gold",
  commit: "bg-[#6b6f5e]",
  mail: "bg-primary",
  automation: "bg-moss",
};

export function AktivitaetsListe({ eintraege, leer }: { eintraege: Aktivitaet[]; leer: React.ReactNode }) {
  if (!eintraege.length) return <div className="text-muted-foreground py-8 text-center text-sm">{leer}</div>;
  return (
    <ol className="relative flex flex-col">
      {eintraege.map((e, i) => {
        const inhalt = (
          <>
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.ton === "bad" ? "bg-rust" : e.ton === "warn" ? "bg-gold" : ART_FARBE[e.art])} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{e.titel}</span>
              <span className="text-muted-foreground block truncate text-xs">{e.quelle}</span>
            </span>
            <time dateTime={e.zeit} title={datumZeit(e.zeit)} className="text-muted-foreground shrink-0 text-xs tabular-nums">{seit(e.zeit)}</time>
          </>
        );
        const klasse = "hover:bg-accent/70 flex items-start gap-3 rounded-md px-2 py-2";
        return (
          <li key={`${e.art}-${e.zeit}-${i}`}>
            {e.href ? (
              e.extern
                ? <a href={e.href} target="_blank" rel="noopener noreferrer" className={klasse}>{inhalt}</a>
                : <Link href={e.href} className={klasse}>{inhalt}</Link>
            ) : <div className={klasse}>{inhalt}</div>}
          </li>
        );
      })}
    </ol>
  );
}
