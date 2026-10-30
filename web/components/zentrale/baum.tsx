// Der Baum der Übersicht. Krone: die Apps nach Bereich. Stamm: das Cockpit,
// das alles zusammenführt. Wurzeln: die Infrastruktur, aus der es sich nährt.
// Jedes Blatt zeigt mit seiner Farbe, ob die App gerade läuft.
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AppLage } from "@/lib/zentrale/lage";
import type { Bereich } from "@/lib/zentrale/register";
import { StatusPunkt } from "./status-punkt";

const KRONE: Bereich[] = ["Vertrieb", "Betrieb", "Finanzen", "Marketing", "KI & Agenten"];

function Blatt({ a }: { a: AppLage }) {
  const eigen = a.rolle === "eigenstaendig";
  return (
    <li>
      <Link
        href={`/apps/${a.id}`}
        title={`${a.name}: ${a.kurz}`}
        className={cn(
          "bg-card hover:border-gold flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
          eigen ? "border-dashed border-[#2e3a2a]/35" : "border-border",
        )}
      >
        <StatusPunkt zustand={a.pruefung.zustand} />
        <span className="truncate">{a.name.split(" · ")[0]}</span>
      </Link>
    </li>
  );
}

// Fünf Äste aus der Mitte zu den fünf Spalten (Mittelpunkte bei 10/30/50/70/90 %).
function Aeste({ richtung }: { richtung: "hoch" | "runter" }) {
  const xs = [10, 30, 50, 70, 90];
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="hidden h-10 w-full md:block" aria-hidden>
      {xs.map((x) => (
        <path
          key={x}
          d={richtung === "hoch" ? `M50 40 C50 18, ${x} 22, ${x} 0` : `M50 0 C50 22, ${x} 18, ${x} 40`}
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function Baum({
  apps, stamm, wurzeln,
}: {
  apps: AppLage[];
  stamm: { label: string; wert: string; href: string }[];
  wurzeln: { label: string; zustand: AppLage["pruefung"]["zustand"]; text: string; href: string }[];
}) {
  return (
    <section aria-label="Alle Apps als Baum" className="mb-10">
      {/* Krone */}
      <div className="grid gap-x-4 gap-y-6 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_50%_100%,rgba(95,132,102,0.16),rgba(95,132,102,0.04)_70%,transparent)] px-4 pt-6 pb-2 md:grid-cols-5">
        {KRONE.map((b) => {
          const liste = apps.filter((a) => a.bereich === b);
          return (
            <div key={b} className="flex flex-col items-center gap-2.5">
              <h3 className="font-serif text-base font-semibold">{b}</h3>
              {liste.length ? (
                <ul className="flex flex-wrap justify-center gap-1.5">
                  {liste.map((a) => <Blatt key={a.id} a={a} />)}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">noch keine App</p>
              )}
            </div>
          );
        })}
      </div>
      <Aeste richtung="hoch" />

      {/* Stamm */}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center">
        <div className="baum-stamm h-4 w-[3px] md:hidden" />
        <div className="bg-primary text-primary-foreground w-full rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-serif text-lg font-semibold">HK Cockpit</p>
            <p className="text-sm text-[#efebe1]/70">führt alles zusammen</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {stamm.map((s) => (
              <Link key={s.label} href={s.href} className="flex flex-col rounded-lg bg-[#3a4734] px-3 py-2 hover:bg-[#45533e]">
                <span className="text-xl font-semibold tabular-nums">{s.wert}</span>
                <span className="text-xs text-[#efebe1]/70">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="baum-stamm h-4 w-[3px] md:hidden" />
      </div>

      {/* Wurzeln */}
      <Aeste richtung="runter" />
      <ul className="grid gap-2 md:grid-cols-5">
        {wurzeln.map((w) => (
          <li key={w.label}>
            <Link href={w.href} className="hover:border-gold border-border flex h-full flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-2.5 text-center">
              <span className="flex items-center gap-2 text-sm font-medium"><StatusPunkt zustand={w.zustand} />{w.label}</span>
              <span className="text-muted-foreground text-xs">{w.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
