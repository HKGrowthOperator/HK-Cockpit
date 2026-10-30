// lib/zentrale/werkzeuge.ts — der Werkzeugkasten: geforkte Open-Source-Werkzeuge,
// mit denen HK arbeitet (Claude-Skills, Video, SEO, Entwicklung). Keine eigenen
// Apps, deshalb getrennt vom Register. Gepflegt werden sie upstream; die
// GitHub-Seite des Forks nennt jeweils das Original.

export type Werkzeug = { repo: string; gruppe: string; kurz: string };

export const WERKZEUGE: Werkzeug[] = [
  { repo: "gstack", gruppe: "Claude Code", kurz: "Skills für Planung, Review, QA und Ausliefern" },
  { repo: "superpowers", gruppe: "Claude Code", kurz: "Arbeitsweisen: Brainstorming, TDD, Pläne" },
  { repo: "claude-mem", gruppe: "Claude Code", kurz: "Gedächtnis über Sitzungen hinweg" },
  { repo: "claude-code-best-practice", gruppe: "Claude Code", kurz: "Muster für Skills, Agenten, Hooks" },
  { repo: "awesome-claude-code", gruppe: "Claude Code", kurz: "Sammlung von Claude-Code-Ressourcen" },
  { repo: "ruflo", gruppe: "Claude Code", kurz: "Multi-Agenten-Orchestrierung" },
  { repo: "unlazy", gruppe: "Claude Code", kurz: "Prüfschranken gegen halbe Arbeit" },
  { repo: "ponytail", gruppe: "Claude Code", kurz: "Claude-Code-Erweiterung" },
  { repo: "rtk", gruppe: "Claude Code", kurz: "Spart Token bei Kommandoausgaben" },
  { repo: "impeccable", gruppe: "Design", kurz: "Design-Skill: Audit, Polish, Typografie" },
  { repo: "taste-skill", gruppe: "Design", kurz: "Gestaltungsgeschmack für Frontends" },
  { repo: "transitions.dev", gruppe: "Design", kurz: "Übergänge und Animationen" },
  { repo: "hyperframes", gruppe: "Video", kurz: "Videos aus HTML rendern (Ads, Erklärvideos)" },
  { repo: "remotion", gruppe: "Video", kurz: "Videos mit React" },
  { repo: "claude-seo", gruppe: "Marketing", kurz: "SEO-Audits und GEO" },
  { repo: "claude-ads", gruppe: "Marketing", kurz: "Anzeigen-Audits und Planung" },
  { repo: "Agent-Reach", gruppe: "Recherche", kurz: "Agenten lesen 13 Plattformen" },
  { repo: "crawl4ai", gruppe: "Recherche", kurz: "Webseiten für KI aufbereiten" },
  { repo: "llm-council", gruppe: "Recherche", kurz: "Mehrere Modelle beraten gemeinsam" },
  { repo: "promptfoo", gruppe: "Qualität", kurz: "Prompts und Agenten testen" },
  { repo: "pingora", gruppe: "Entwicklung", kurz: "Proxy-Framework in Rust" },
];

export const WERKZEUG_GRUPPEN = [...new Set(WERKZEUGE.map((w) => w.gruppe))];
