// lib/zentrale/navigation.ts — eine Quelle für Seitenleiste und Befehlspalette.
import type { AppAnsicht } from "./apps";
import { adresse } from "./register";
import type { PalettenEintrag } from "@/components/zentrale/befehlspalette";

export type NavEintrag = { href: string; label: string; icon: string; extern?: boolean; zahl?: number };
export type NavGruppe = { gruppe: string; items: NavEintrag[] };

export function navigation(apps: AppAnsicht[], mailOffen: number): NavGruppe[] {
  const eigen = apps.filter((a) => a.rolle === "eigenstaendig" && a.urlAufgeloest);
  const n8n = apps.find((a) => a.id === "n8n")?.urlAufgeloest;
  return [
    { gruppe: "Zentrale", items: [
      { href: "/", label: "Übersicht", icon: "baum" },
      { href: "/apps", label: "Apps & Repos", icon: "wall" },
      { href: "/aktivitaet", label: "Aktivität", icon: "puls" },
      { href: "/mail", label: "Mail-Zentrale", icon: "mail", zahl: mailOffen || undefined },
    ] },
    { gruppe: "Betrieb", items: [
      { href: "/kundenbedienung", label: "Kunden", icon: "users" },
      { href: "/rechnungen", label: "Rechnungen", icon: "euro" },
      { href: "/buchhaltung", label: "Buchhaltung", icon: "buch" },
      { href: "/sops", label: "SOPs", icon: "list" },
      { href: "/berichte", label: "Berichte", icon: "report" },
      { href: "/automation", label: "Automationen", icon: "bolt" },
    ] },
    { gruppe: "Wachstum", items: [
      { href: "/lead-radar", label: "Lead-Radar", icon: "radar" },
      { href: "/konzepte", label: "Konzepte", icon: "bulb" },
      { href: "/webseiten", label: "Webseiten", icon: "globe" },
    ] },
    { gruppe: "Intelligenz", items: [
      { href: "/assistent", label: "Assistent", icon: "spark" },
      { href: "/team", label: "Agenten-Team", icon: "team" },
      { href: "/bibliothek", label: "Bibliothek", icon: "library" },
      { href: "/ai-intelligence", label: "AI Intelligence", icon: "brain" },
    ] },
    { gruppe: "Eigenständig", items: eigen.map((a) => ({ href: a.urlAufgeloest!, label: a.name.split(" · ")[0], icon: "pfeil", extern: true })) },
    { gruppe: "System", items: [
      { href: "/einstellungen", label: "Einstellungen", icon: "cog" },
      { href: "/drive", label: "Google Drive", icon: "drive" },
      ...(n8n ? [{ href: n8n, label: "n8n", icon: "flow", extern: true }] : []),
    ] },
  ];
}

export function palettenEintraege(apps: AppAnsicht[], nav: NavGruppe[]): PalettenEintrag[] {
  const liste: PalettenEintrag[] = [
    { gruppe: "Handgriffe", label: "Neue Mail schreiben", href: "/mail/neu" },
    { gruppe: "Handgriffe", label: "Mails freigeben", href: "/mail" },
    { gruppe: "Handgriffe", label: "Mail-Vorlage anlegen", href: "/mail/vorlagen" },
    { gruppe: "Handgriffe", label: "Mail-Regel anlegen", href: "/mail/regeln" },
    { gruppe: "Handgriffe", label: "Automation starten", href: "/automation" },
    { gruppe: "Handgriffe", label: "Buchung erfassen", href: "/buchhaltung/buchungen" },
  ];
  for (const g of nav) {
    for (const i of g.items) liste.push({ gruppe: "Seiten", label: i.label, href: i.href, extern: i.extern, zusatz: g.gruppe });
  }
  for (const a of apps) {
    liste.push({ gruppe: "Apps", label: a.name, href: `/apps/${a.id}`, zusatz: "Details" });
    if (a.urlAufgeloest) liste.push({ gruppe: "Apps öffnen", label: a.name, href: a.urlAufgeloest, extern: true });
    for (const b of a.bedienung ?? []) {
      const ziel = adresse(a.urlAufgeloest, b.pfad);
      if (ziel) liste.push({ gruppe: "Direkt in die App", label: `${a.name.split(" · ")[0]}: ${b.label}`, href: ziel, extern: true, zusatz: b.hinweis });
    }
    if (a.repo) liste.push({ gruppe: "Repositories", label: a.repo.split("/")[1], href: `https://github.com/${a.repo}`, extern: true });
  }
  return liste;
}
