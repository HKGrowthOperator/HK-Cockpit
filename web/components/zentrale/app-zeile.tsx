import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AppLage } from "@/lib/zentrale/lage";
import { ROLLEN_TEXT } from "@/lib/zentrale/register";
import { ZUSTAND_TEXT } from "@/lib/zentrale/health-text";
import { StatusPunkt } from "./status-punkt";
import { seit } from "./zeit";
import { knopfKlasse } from "./stil";

export function CiMarke({ ergebnis, zustand }: { ergebnis: string | null; zustand: string }) {
  const text = zustand !== "completed" ? "läuft" : ergebnis === "success" ? "grün" : ergebnis === "failure" ? "rot" : ergebnis ?? "–";
  const ton = text === "grün" ? "text-moss" : text === "rot" ? "text-rust" : "text-muted-foreground";
  return <span className={cn("text-xs font-medium", ton)}>CI {text}</span>;
}

export function AppZeile({ a, github, githubFehler }: { a: AppLage; github: boolean; githubFehler?: string }) {
  const s = a.stand;
  return (
    <li className="border-border grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 border-b px-2 py-3 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_10rem_11rem_auto]">
      <StatusPunkt zustand={a.pruefung.zustand} groesse="md" titel={`${ZUSTAND_TEXT[a.pruefung.zustand]}${a.pruefung.meldung ? `: ${a.pruefung.meldung}` : ""}`} />
      <div className="min-w-0">
        <Link href={`/apps/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
        {a.status && a.status !== "aktiv" && (
          <span className="border-border text-muted-foreground ml-2 rounded border px-1.5 py-0.5 text-xs">{a.status === "im-aufbau" ? "im Aufbau" : "geplant"}</span>
        )}
        <p className="text-muted-foreground truncate text-sm">{a.kurz}</p>
      </div>
      <p className="text-muted-foreground col-start-2 text-xs md:col-start-auto">
        {ROLLEN_TEXT[a.rolle] === a.bereich ? a.bereich : `${ROLLEN_TEXT[a.rolle]}, ${a.bereich}`}
      </p>
      <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs md:col-start-auto">
        {!a.repo ? <span className="text-muted-foreground">kein Repo</span>
          : !github ? <span className="text-muted-foreground">Code: GitHub nicht verbunden</span>
          : githubFehler ? <span className="text-muted-foreground">Code: nicht lesbar</span>
          : a.standFehler ? <span className="text-rust">{a.standFehler}</span>
          : s ? (
            <>
              <span title={s.zuletztGepusht ?? ""}>Code {seit(s.zuletztGepusht)}</span>
              {s.pullRequests.length > 0 && <span className="text-gold-ink font-medium">{s.pullRequests.length} PR</span>}
              {s.ci && <CiMarke ergebnis={s.ci.ergebnis} zustand={s.ci.zustand} />}
            </>
          ) : null}
      </div>
      <div className="col-start-2 md:col-start-auto">
        {a.urlAufgeloest ? (
          <a href={a.urlAufgeloest} target="_blank" rel="noopener noreferrer" className={knopfKlasse("zweit")}>Öffnen</a>
        ) : (
          <Link href={`/apps/${a.id}`} className={knopfKlasse("leise")}>Adresse eintragen</Link>
        )}
      </div>
    </li>
  );
}
