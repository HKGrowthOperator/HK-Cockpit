"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

type NavItem = { href: string; label: string; icon: string; external?: boolean };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { group: "Start", items: [{ href: "/", label: "Übersicht", icon: "wall" }] },
  { group: "Intelligenz", items: [
    { href: "/team", label: "Agenten-Team", icon: "team" },
    { href: "/bibliothek", label: "Bibliothek", icon: "library" },
    { href: "/assistent", label: "Assistent", icon: "spark" },
    { href: "/ai-intelligence", label: "AI Intelligence", icon: "brain" },
  ] },
  { group: "Betrieb", items: [
    { href: "/sops", label: "SOPs", icon: "list" },
    { href: "/kundenbedienung", label: "Kundenbedienung", icon: "users" },
    { href: "/berichte", label: "Berichte", icon: "report" },
    { href: "/automation", label: "Automation", icon: "bolt" },
  ] },
  { group: "Wachstum", items: [
    { href: "/lead-radar", label: "Lead-Radar", icon: "radar" },
    { href: "/konzepte", label: "Konzepte", icon: "bulb" },
    { href: "/webseiten", label: "Webseiten", icon: "globe" },
  ] },
  { group: "System", items: [
    { href: "/einstellungen", label: "Einstellungen", icon: "cog" },
    { href: "/drive", label: "Google Drive", icon: "drive" },
    { href: "http://localhost:5678", label: "n8n (Automationen)", icon: "flow", external: true },
  ] },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

function titleFor(pathname: string): string {
  const match = ALL_ITEMS.filter((i) => !i.external)
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Command Center";
}

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
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
  };
  return <svg {...common}>{paths[name] ?? null}</svg>;
}

export function AppShell({ email, children }: { email?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (i: NavItem) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-30 flex w-64 flex-col gap-5 overflow-y-auto border-r p-4 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[105%]",
        )}
      >
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
          <span className="bg-gold grid h-10 w-10 place-items-center rounded-lg font-serif text-base font-bold text-[#2e3a2a]">HK</span>
          <span className="flex flex-col leading-tight">
            <strong className="font-serif text-base">HK Growth</strong>
            <span className="text-xs text-[#efebe1]/55">Verwurzeltes Wachstum</span>
          </span>
        </Link>

        <nav className="flex flex-col gap-1" aria-label="Module">
          {NAV.map((g) => (
            <div key={g.group} className="flex flex-col gap-1">
              <p className="mt-3 mb-1 px-2 text-[11px] font-medium tracking-wider text-[#efebe1]/45 uppercase">{g.group}</p>
              {g.items.map((i) =>
                i.external ? (
                  <a key={i.href} href={i.href} target="_blank" rel="noopener noreferrer"
                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#efebe1]/75">
                    <Icon name={i.icon} /> {i.label}
                  </a>
                ) : (
                  <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive(i) ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-[#efebe1]/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}>
                    <Icon name={i.icon} /> {i.label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/85 sticky top-0 z-10 flex items-center gap-3 border-b px-5 py-3 backdrop-blur">
          <button type="button" aria-label="Navigation" onClick={() => setOpen((v) => !v)}
            className="border-border bg-card grid h-9 w-9 place-items-center rounded-md border md:hidden">☰</button>
          <h1 className="font-serif text-xl font-bold">{titleFor(pathname)}</h1>
          <div className="flex-1" />
          {email && <span className="text-muted-foreground hidden text-xs sm:block">{email}</span>}
          <LogoutButton />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
