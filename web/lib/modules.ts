// lib/modules.ts — zentrale Definition jedes editierbaren Moduls:
// Formularfelder (für Anlegen/Bearbeiten) und Abbildung Datensatz → Karten-UI.
// Startinhalte liegen in lib/data/*.
import type { CardModel, Tone } from "@/lib/data/types";
import { riskTone } from "@/lib/data/types";
import { sops } from "@/lib/data/sops";
import { clients, templates } from "@/lib/data/customer-service";
import { concepts } from "@/lib/data/concepts";
import { automations } from "@/lib/data/automation";
import { websites } from "@/lib/data/websites";
import { updates, experiments, opportunities, learning, risks } from "@/lib/data/ai-intelligence";

export type FieldType = "text" | "textarea" | "list" | "tags" | "select" | "number";
export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  full?: boolean; // über beide Spalten im Formularraster
};
export type Rec = { id: string; data: Record<string, unknown> };
export type ModuleDef = {
  key: string;
  label: string;
  noun: string; // für den „+ Neu"-Button / Titel
  fields: Field[];
  toCard: (rec: Rec) => CardModel;
};

// ── kleine Helfer ───────────────────────────────────────────────────────────
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const lvlBadge = (l: string): Tone => (l === "hoch" ? "bad" : l === "mittel" ? "warn" : "ok");
const hypeBadge = (l: string): Tone => (l === "Hype" ? "bad" : l === "gemischt" ? "warn" : "ok");

// ── Moduldefinitionen ───────────────────────────────────────────────────────
export const MODULES: Record<string, ModuleDef> = {
  sops: {
    key: "sops", label: "SOPs", noun: "SOP",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "area", label: "Bereich", type: "text" },
      { name: "owner", label: "Verantwortlich", type: "text" },
      { name: "summary", label: "Kurzbeschreibung", type: "textarea", full: true },
      { name: "steps", label: "Schritte (eine Zeile = ein Schritt)", type: "list", full: true },
      { name: "tools", label: "Werkzeuge", type: "tags" },
      { name: "tags", label: "Schlagwörter", type: "tags" },
    ],
    toCard: ({ id, data: d }) => ({
      id, accent: "brand",
      badges: [{ text: str(d.area) || "SOP", tone: "brand" }, ...(d.updated ? [{ text: `aktualisiert ${str(d.updated)}`, tone: "neutral" as const }] : [])],
      title: str(d.title), description: str(d.summary),
      bullets: arr(d.steps).length ? [{ label: "Schritte", items: arr(d.steps) }] : undefined,
      metas: d.owner ? [{ label: "Verantwortlich", value: str(d.owner) }] : undefined,
      footBadges: arr(d.tools).map((t) => ({ text: t, tone: "outline" as const })),
      tags: arr(d.tags),
    }),
  },

  clients: {
    key: "clients", label: "Kunden", noun: "Kunde",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, full: true },
      { name: "contact", label: "Kontakt (E-Mail/Tel.)", type: "text" },
      { name: "status", label: "Status", type: "select", options: ["aktiv", "Interessent", "pausiert", "verloren"] },
      { name: "since", label: "Kunde seit", type: "text" },
      { name: "notes", label: "Notizen", type: "textarea", full: true },
      { name: "tags", label: "Schlagwörter", type: "tags", full: true },
    ],
    toCard: ({ id, data: d }) => {
      const s = str(d.status);
      const tone: Tone = s === "aktiv" ? "ok" : s === "Interessent" ? "brand" : s === "pausiert" ? "warn" : "bad";
      return {
        id, accent: tone === "bad" ? "bad" : tone === "warn" ? "warn" : tone === "ok" ? "ok" : "brand",
        badges: [{ text: s || "—", tone }],
        title: str(d.name),
        metas: [
          ...(d.contact ? [{ label: "Kontakt", value: str(d.contact) }] : []),
          ...(d.since ? [{ label: "Kunde seit", value: str(d.since) }] : []),
        ],
        description: str(d.notes), tags: arr(d.tags),
      };
    },
  },

  templates: {
    key: "templates", label: "Vorlagen", noun: "Vorlage",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "channel", label: "Kanal", type: "select", options: ["E-Mail", "Chat", "SMS"] },
      { name: "category", label: "Kategorie", type: "text" },
      { name: "body", label: "Text ({{Platzhalter}} erlaubt)", type: "textarea", full: true },
    ],
    toCard: ({ id, data: d }) => ({
      id,
      badges: [{ text: str(d.channel) || "Text", tone: "brand" }, ...(d.category ? [{ text: str(d.category), tone: "neutral" as const }] : [])],
      title: str(d.title), pre: str(d.body),
    }),
  },

  concepts: {
    key: "concepts", label: "Konzepte", noun: "Konzept",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "type", label: "Art", type: "select", options: ["Angebot", "Strategie", "Kampagne"] },
      { name: "status", label: "Status", type: "select", options: ["Idee", "Entwurf", "bereit", "live"] },
      { name: "summary", label: "Kurzbeschreibung", type: "textarea", full: true },
      { name: "value", label: "Wert / Nutzen", type: "textarea", full: true },
      { name: "steps", label: "Schritte", type: "list", full: true },
    ],
    toCard: ({ id, data: d }) => {
      const s = str(d.status);
      const tone: Tone = s === "live" ? "ok" : s === "bereit" ? "brand" : s === "Entwurf" ? "warn" : "neutral";
      return {
        id, accent: "brand",
        badges: [{ text: str(d.type) || "—", tone: "neutral" }, { text: s || "—", tone }],
        title: str(d.title), description: str(d.summary),
        metas: d.value ? [{ label: "Wert", value: str(d.value) }] : undefined,
        bullets: arr(d.steps).length ? [{ label: "Schritte", items: arr(d.steps) }] : undefined,
      };
    },
  },

  automations: {
    key: "automations", label: "Automationen", noun: "Automation",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "status", label: "Status", type: "select", options: ["Idee", "im Bau", "live", "pausiert"] },
      { name: "trigger", label: "Auslöser", type: "textarea", full: true },
      { name: "action", label: "Aktion", type: "textarea", full: true },
      { name: "value", label: "Nutzen", type: "textarea", full: true },
      { name: "tools", label: "Werkzeuge", type: "tags", full: true },
    ],
    toCard: ({ id, data: d }) => {
      const s = str(d.status);
      const tone: Tone = s === "live" ? "ok" : s === "im Bau" ? "warn" : s === "pausiert" ? "bad" : "neutral";
      const accent = s === "live" ? "ok" : s === "im Bau" ? "warn" : s === "pausiert" ? "bad" : undefined;
      return {
        id, accent,
        badges: [{ text: s || "—", tone }],
        title: str(d.title),
        metas: [
          ...(d.trigger ? [{ label: "Auslöser", value: str(d.trigger) }] : []),
          ...(d.action ? [{ label: "Aktion", value: str(d.action) }] : []),
          ...(d.value ? [{ label: "Nutzen", value: str(d.value) }] : []),
        ],
        footBadges: arr(d.tools).map((t) => ({ text: t, tone: "outline" as const })),
      };
    },
  },

  websites: {
    key: "websites", label: "Webseiten", noun: "Webseite",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, full: true },
      { name: "client", label: "Kunde", type: "text" },
      { name: "status", label: "Status", type: "select", options: ["geplant", "im Bau", "live", "Wartung"] },
      { name: "url", label: "URL", type: "text", full: true },
      { name: "stack", label: "Technik", type: "text" },
      { name: "notes", label: "Notizen", type: "textarea", full: true },
    ],
    toCard: ({ id, data: d }) => {
      const s = str(d.status);
      const tone: Tone = s === "live" ? "ok" : s === "im Bau" ? "warn" : s === "Wartung" ? "brand" : "neutral";
      const accent = s === "live" ? "ok" : s === "im Bau" ? "warn" : s === "Wartung" ? "brand" : undefined;
      return {
        id, accent,
        badges: [{ text: s || "—", tone }],
        title: str(d.name),
        metas: [
          ...(d.client ? [{ label: "Kunde", value: str(d.client) }] : []),
          ...(d.stack ? [{ label: "Technik", value: str(d.stack) }] : []),
        ],
        description: str(d.notes),
        link: d.url ? { href: str(d.url), text: str(d.url) } : undefined,
      };
    },
  },

  ai_updates: {
    key: "ai_updates", label: "Updates", noun: "Update",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "summary", label: "Zusammenfassung", type: "textarea", full: true },
      { name: "company", label: "Anbieter", type: "text" },
      { name: "category", label: "Kategorie", type: "text" },
      { name: "date", label: "Datum", type: "text" },
      { name: "relevanceScore", label: "Relevanz (0–100)", type: "number" },
      { name: "businessImpact", label: "Business-Impact", type: "textarea", full: true },
      { name: "businessRelevance", label: "Warum für uns", type: "textarea", full: true },
      { name: "recommendedAction", label: "Empfohlene Aktion", type: "textarea", full: true },
      { name: "riskLevel", label: "Risiko", type: "select", options: ["niedrig", "mittel", "hoch"] },
      { name: "hypeLevel", label: "Hype", type: "select", options: ["fundiert", "gemischt", "Hype"] },
      { name: "riskTypes", label: "Risiko-Typen", type: "tags" },
      { name: "tags", label: "Schlagwörter", type: "tags" },
    ],
    toCard: ({ id, data: d }) => ({
      id, accent: riskTone(str(d.riskLevel) || "niedrig"),
      score: d.relevanceScore != null ? num(d.relevanceScore) : undefined,
      badges: [
        ...(d.company ? [{ text: str(d.company), tone: "brand" as const }] : []),
        ...(d.category ? [{ text: str(d.category), tone: "neutral" as const }] : []),
        ...(d.date ? [{ text: str(d.date), tone: "neutral" as const }] : []),
      ],
      title: str(d.title), description: str(d.summary),
      metas: [
        ...(d.businessImpact ? [{ label: "Business-Impact", value: str(d.businessImpact) }] : []),
        ...(d.businessRelevance ? [{ label: "Warum es für uns zählt", value: str(d.businessRelevance) }] : []),
      ],
      highlight: d.recommendedAction ? { label: "Empfohlene Aktion", value: str(d.recommendedAction), tone: "brand" } : undefined,
      footBadges: [
        ...(d.riskLevel ? [{ text: `Risiko: ${str(d.riskLevel)}`, tone: lvlBadge(str(d.riskLevel)) }] : []),
        ...(d.hypeLevel ? [{ text: `Hype: ${str(d.hypeLevel)}`, tone: hypeBadge(str(d.hypeLevel)) }] : []),
        ...arr(d.riskTypes).map((t) => ({ text: t, tone: "outline" as const })),
      ],
      tags: arr(d.tags),
    }),
  },

  ai_experiments: {
    key: "ai_experiments", label: "Experimente", noun: "Experiment",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "week", label: "Woche", type: "text" },
      { name: "status", label: "Status", type: "select", options: ["vorgeschlagen", "läuft", "validiert", "verworfen"] },
      { name: "value", label: "Wert", type: "textarea", full: true },
      { name: "validation", label: "Validierung", type: "textarea", full: true },
      { name: "steps", label: "Schritte", type: "list", full: true },
      { name: "tools", label: "Werkzeuge", type: "tags", full: true },
    ],
    toCard: ({ id, data: d }) => {
      const s = str(d.status);
      const tone: Tone = s === "validiert" ? "ok" : s === "verworfen" ? "bad" : "warn";
      return {
        id,
        badges: [...(d.week ? [{ text: str(d.week), tone: "neutral" as const }] : []), { text: s || "—", tone }],
        title: str(d.title),
        metas: [
          ...(d.value ? [{ label: "Wert", value: str(d.value) }] : []),
          ...(d.validation ? [{ label: "Validierung", value: str(d.validation) }] : []),
        ],
        bullets: arr(d.steps).length ? [{ label: "Schritte", items: arr(d.steps) }] : undefined,
        tags: arr(d.tools),
      };
    },
  },

  ai_opportunities: {
    key: "ai_opportunities", label: "Chancen", noun: "Chance",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "effort", label: "Aufwand", type: "select", options: ["niedrig", "mittel", "hoch"] },
      { name: "value", label: "Verkaufbarer Wert", type: "textarea", full: true },
      { name: "validate", label: "Nachfrage validieren", type: "textarea", full: true },
      { name: "steps", label: "Schritte", type: "list", full: true },
      { name: "tools", label: "Werkzeuge", type: "tags", full: true },
    ],
    toCard: ({ id, data: d }) => ({
      id, accent: "brand",
      badges: d.effort ? [{ text: `Aufwand: ${str(d.effort)}`, tone: "neutral" }] : undefined,
      title: str(d.title),
      metas: [
        ...(d.value ? [{ label: "Verkaufbarer Wert", value: str(d.value) }] : []),
        ...(d.validate ? [{ label: "Nachfrage validieren", value: str(d.validate) }] : []),
      ],
      bullets: arr(d.steps).length ? [{ label: "Schritte", items: arr(d.steps) }] : undefined,
      tags: arr(d.tools),
    }),
  },

  ai_learning: {
    key: "ai_learning", label: "Lernen", noun: "Begriff",
    fields: [
      { name: "term", label: "Begriff", type: "text", required: true, full: true },
      { name: "definition", label: "Definition", type: "textarea", full: true },
      { name: "whyItMatters", label: "Warum es zählt", type: "textarea", full: true },
      { name: "example", label: "Beispiel", type: "textarea", full: true },
    ],
    toCard: ({ id, data: d }) => ({
      id, title: str(d.term), description: str(d.definition),
      metas: [
        ...(d.whyItMatters ? [{ label: "Warum es zählt", value: str(d.whyItMatters) }] : []),
        ...(d.example ? [{ label: "Beispiel", value: str(d.example) }] : []),
      ],
    }),
  },

  ai_risks: {
    key: "ai_risks", label: "Risiken", noun: "Risiko",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true, full: true },
      { name: "riskLevel", label: "Risiko", type: "select", options: ["niedrig", "mittel", "hoch"] },
      { name: "riskTypes", label: "Risiko-Typen", type: "tags" },
      { name: "description", label: "Beschreibung", type: "textarea", full: true },
      { name: "mitigation", label: "Gegenmaßnahme", type: "textarea", full: true },
    ],
    toCard: ({ id, data: d }) => ({
      id, accent: riskTone(str(d.riskLevel) || "niedrig"),
      badges: [
        ...(d.riskLevel ? [{ text: `Risiko: ${str(d.riskLevel)}`, tone: lvlBadge(str(d.riskLevel)) }] : []),
        ...arr(d.riskTypes).map((t) => ({ text: t, tone: "outline" as const })),
      ],
      title: str(d.title), description: str(d.description),
      highlight: d.mitigation ? { label: "Gegenmaßnahme", value: str(d.mitigation) } : undefined,
    }),
  },
};

export const MODULE_KEYS = Object.keys(MODULES);

// Startinhalte beim ersten leeren Zustand eines Moduls.
export const SEEDS: Record<string, unknown[]> = {
  sops, clients, templates, concepts, automations, websites,
  ai_updates: updates, ai_experiments: experiments, ai_opportunities: opportunities,
  ai_learning: learning, ai_risks: risks,
};
