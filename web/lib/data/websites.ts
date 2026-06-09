// lib/data/websites.ts — Kundenwebseiten und ihr Build-Status.
import type { Website } from "./types";

export const websites: Website[] = [
  { id: "web-nordwind", name: "Nordwind — Unternehmensseite", client: "Nordwind GmbH", status: "live", url: "https://nordwind.example", stack: "Statisch + CMS", notes: "Quartals-Inhaltsauffrischung im Juli fällig." },
  { id: "web-helios", name: "Helios Praxis — Landingpage", client: "Helios Praxis", status: "im Bau", url: "", stack: "Statisch", notes: "Datenschutz-first; keine Drittanbieter-Tracker. Wartet auf Texte." },
  { id: "web-brandt", name: "Brandt & Partner — Relaunch", client: "Brandt & Partner", status: "geplant", url: "", stack: "Offen", notes: "Scope-Workshop terminiert. Barrierefreiheit ist Pflichtanforderung." },
  { id: "web-maekelei", name: "Mäkelei — Onepager", client: "Mäkelei Handwerk", status: "Wartung", url: "https://maekelei.example", stack: "Statisch", notes: "Minimale Pflege, solange der Kunde pausiert." },
];
