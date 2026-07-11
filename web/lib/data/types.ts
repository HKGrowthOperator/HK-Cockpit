// lib/data/types.ts — shared types for the module data and the generic card UI.
// Data files stay semantic; pages map them to CardModel for rendering.

export type Tone = "neutral" | "brand" | "ok" | "warn" | "bad" | "outline";
export type Accent = "brand" | "ok" | "warn" | "bad";

export type Badge = { text: string; tone?: Tone };
export type Meta = { label: string; value: string };
export type BulletGroup = { label: string; items: string[] };
export type Highlight = { label: string; value: string; tone?: Tone };

/** Serializable model the generic <CardGrid>/<TabbedCards> render. */
export type CardModel = {
  id: string;
  title: string;
  accent?: Accent;
  score?: number;
  badges?: Badge[];
  description?: string;
  metas?: Meta[];
  highlight?: Highlight;
  bullets?: BulletGroup[];
  footBadges?: Badge[];
  tags?: string[];
  pre?: string;
  link?: { href: string; text: string };
};

// ── semantic entity types ─────────────────────────────────────────────────
export type RiskLevel = "niedrig" | "mittel" | "hoch";
export type HypeLevel = "fundiert" | "gemischt" | "Hype";

export type AIUpdate = {
  id: string;
  title: string;
  summary: string;
  company: string;
  category: string;
  date: string;
  relevanceScore: number;
  businessImpact: string;
  businessRelevance: string;
  recommendedAction: string;
  riskLevel: RiskLevel;
  riskTypes: string[];
  hypeLevel: HypeLevel;
  tags: string[];
};

export type Experiment = {
  id: string; title: string; week: string; value: string;
  tools: string[]; steps: string[]; validation: string; status: string;
};
export type Opportunity = {
  id: string; title: string; value: string; effort: string;
  tools: string[]; steps: string[]; validate: string;
};
export type LearningConcept = {
  id: string; term: string; definition: string; whyItMatters: string; example: string;
};
export type RiskAssessment = {
  id: string; title: string; riskLevel: RiskLevel; riskTypes: string[];
  description: string; mitigation: string;
};

export type Sop = {
  id: string; title: string; area: string; summary: string;
  steps: string[]; tools: string[]; owner: string; updated: string; tags: string[];
};
export type Client = {
  id: string; name: string; contact: string; status: string; since: string; notes: string; tags: string[];
};
export type Template = {
  id: string; title: string; channel: string; category: string; body: string;
};
export type Concept = {
  id: string; title: string; type: string; status: string; summary: string; value: string; steps: string[];
};
export type Automation = {
  id: string; title: string; status: string; trigger: string; action: string; tools: string[]; value: string;
};
export type Website = {
  id: string; name: string; client: string; status: string; url: string; stack: string; notes: string;
};

// ── tone helpers ──────────────────────────────────────────────────────────
export const riskTone = (l: string): Accent => (l === "hoch" ? "bad" : l === "mittel" ? "warn" : "ok");
export const hypeTone = (l: string): Accent => (l === "Hype" ? "bad" : l === "gemischt" ? "warn" : "ok");
