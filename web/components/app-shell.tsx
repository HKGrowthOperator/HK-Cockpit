"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import { Befehlspalette, PalettenKnopf, type PalettenEintrag } from "@/components/zentrale/befehlspalette";
import { Meldungen } from "@/components/zentrale/meldungen";
import type { NavGruppe, NavEintrag } from "@/lib/zentrale/navigation";

function titleFor(nav: NavGruppe[], pathname: string): string {
  const match = nav.flatMap((g) => g.items).filter((i) => !i.extern)
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Cockpit";
}

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, React.ReactNode> = {
    baum: <><path d="M12 22v-8" /><path d="M12 14c-4 0-7-2.5-7-6a5 5 0 0 1 4-4.9A4 4 0 0 1 12 2a4 4 0 0 1 3 1.1A5 5 0 0 1 19 8c0 3.5-3 6-7 6z" /><path d="M9 22h6" /></>,
    puls: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    buch: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>,
    pfeil: <><path d="M7 17 17 7M8 7h9v9" /></>,
    wall: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12M3 15h6" /></>,
    brain: <><path d="M12 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V17a2 2 0 0 0 4 0V5z" /><path d="M12 5a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V17a2 2 0 0 1-4 0" /></>,
    spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    bolt: <><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></>,
    bulb: <><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></>,
    flow: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 6h6a3 3 0 0 1 3 3v6" /></>,
    report: <><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    drive: <><path d="M7 17a4 4 0 0 1-.5-7.97 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 17z" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14h1a4 4 0 0 1 4 4v1" /></>,
    radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12 19 5M12 12v9" /></>,
    library: <><path d="M4 5v14M8 5v14M13 5l4 14" /><path d="M3 19h18" /></>,
    cog: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    euro: <><path d="M15 7a5 5 0 1 0 0 10M4 10h7M4 14h7" /></>,
  };
  return <svg {...common}>{paths[name] ?? null}</svg>;
}

function Eintrag({ i, aktiv, schliessen }: { i: NavEintrag; aktiv: boolean; schliessen: () => void }) {
  const klasse = cn(
    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
    aktiv ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-[#efebe1]/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );
  const inhalt = (
    <>
      <Icon name={i.icon} />
      <span className="flex-1">{i.label}</span>
      {i.zahl ? <span className="bg-gold rounded-full px-1.5 text-xs font-semibold text-[#2e3a2a] tabular-nums">{i.zahl}</span> : null}
    </>
  );
  return i.extern ? (
    <a href={i.href} target="_blank" rel="noopener noreferrer" className={klasse}>{inhalt}</a>
  ) : (
    <Link href={i.href} onClick={schliessen} className={klasse} aria-current={aktiv ? "page" : undefined}>{inhalt}</Link>
  );
}

export function AppShell({
  name, rolle, nav, palette, children,
}: {
  name?: string; rolle?: "gf" | "team"; nav: NavGruppe[]; palette: PalettenEintrag[]; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (i: NavEintrag) => !i.extern && (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href));

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-30 flex w-60 flex-col gap-4 overflow-y-auto border-r px-3 py-4 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[105%]",
        )}
      >
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-2">
          <span className="bg-gold grid h-9 w-9 place-items-center rounded-lg font-serif text-sm font-bold text-[#2e3a2a]">HK</span>
          <span className="flex flex-col leading-tight">
            <strong className="font-serif text-base font-semibold">HK Cockpit</strong>
            <span className="text-xs text-[#efebe1]/55">Verwurzeltes Wachstum</span>
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5" aria-label="Bereiche">
          {nav.filter((g) => g.items.length).map((g) => (
            <div key={g.gruppe} className="flex flex-col gap-0.5">
              <p className="mt-3 mb-1 px-3 text-xs text-[#efebe1]/45">{g.gruppe}</p>
              {g.items.map((i) => <Eintrag key={i.href + i.label} i={i} aktiv={isActive(i)} schliessen={() => setOpen(false)} />)}
            </div>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/85 sticky top-0 z-10 flex items-center gap-3 border-b px-5 py-3 backdrop-blur">
          <button type="button" aria-label="Navigation öffnen" onClick={() => setOpen((v) => !v)}
            className="border-border bg-card grid h-9 w-9 place-items-center rounded-md border md:hidden">☰</button>
          <h1 className="font-serif text-xl font-semibold">{titleFor(nav, pathname)}</h1>
          <div className="flex-1" />
          <PalettenKnopf />
          {name && (
            <span className="text-muted-foreground hidden text-xs lg:block">
              {name}{rolle === "gf" ? ", Geschäftsführung" : ""}
            </span>
          )}
          <LogoutButton />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">{children}</main>
      </div>
      <Befehlspalette eintraege={palette} />
      <Meldungen />
    </div>
  );
}
