// lib/agents.ts — das KI-Team einer Wachstumsagentur. Jede Rolle ist ein echter
// Claude-Workflow mit eigenem System-Prompt + Cockpit-Kontext. Läufe werden in
// agent_runs protokolliert (Kosten/Tokens), damit das Dashboard sie live zeigt.
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "./db";
import { getClientAsync, resolveModel, buildContext } from "./assistant";
import { HK_BRIEF } from "./hk";

export type Agent = {
  id: string;
  name: string;
  role: string;
  emoji: string;
  accent: string; // Hex für die Akzent-Tönung der Karte
  blurb: string;
  focus?: boolean; // Schwerpunkt (Content & Outreach) hervorheben
  tasks: string[]; // Vorschlags-Chips
  placeholder: string;
  system: string;
};

const FORMAT_HINT =
  "Antworte auf Deutsch, sofort einsetzbar, ohne Vorrede. Wenn mehrere Varianten sinnvoll sind, nummeriere sie. Nutze echte Namen/Fakten aus dem Cockpit-Kontext, erfinde keine Kundendaten.";

export const AGENTS: Agent[] = [
  {
    id: "content",
    name: "Mara",
    role: "Content-Strategin",
    emoji: "📝",
    accent: "#3f7d52",
    blurb: "Schreibt Posts, Hooks & Karussells, die zur Marke passen.",
    focus: true,
    tasks: [
      "LinkedIn-Post über unser Angebot",
      "5 Hook-Varianten für ein Reel",
      "Karussell (6 Slides) zu einem Konzept",
    ],
    placeholder: "Worüber? z. B. „LinkedIn-Post: warum Agenturen KI-Outreach brauchen, Tonalität locker-fachlich“",
    system: `Du bist Mara, Senior Content-Strategin in einer Wachstumsagentur. Du schreibst Social-Content (LinkedIn, Instagram, X), der stoppt, Mehrwert liefert und subtil zum Angebot führt. Starke Hooks, konkrete Beispiele, klare CTA, kein Buzzword-Bingo. ${FORMAT_HINT}`,
  },
  {
    id: "outreach",
    name: "Tobias",
    role: "Outreach / SDR",
    emoji: "✉️",
    accent: "#2f6f8f",
    blurb: "Cold-Mails, DMs & Follow-up-Sequenzen, personalisiert.",
    focus: true,
    tasks: [
      "Cold-Mail an einen Wunschkunden",
      "3-stufige Follow-up-Sequenz",
      "LinkedIn-DM (kurz, kein Pitch-Slap)",
    ],
    placeholder: "An wen & Ziel? z. B. „Cold-Mail an Zahnarztpraxen, Termin für 15-Min-Call, Nutzen: mehr Patientenanfragen“",
    system: `Du bist Tobias, Outbound-Spezialist (SDR). Du schreibst kurze, personalisierte Cold-Mails und DMs mit relevantem Aufhänger, einem klaren Nutzen und einer niedrigschwelligen CTA (kein Hard-Sell). Betreffzeilen knackig. Bei Sequenzen: jede Stufe mit Zweck + Abstand. ${FORMAT_HINT}`,
  },
  {
    id: "research",
    name: "Nadia",
    role: "Market Research",
    emoji: "🔎",
    accent: "#6b5bb5",
    blurb: "ICP, Wettbewerbs-Winkel & Schmerzpunkte recherchieren.",
    tasks: [
      "ICP-Profil für eine Zielbranche",
      "Pain-Points + Botschaften ableiten",
      "3 Differenzierungs-Winkel zum Wettbewerb",
    ],
    placeholder: "Zielmarkt? z. B. „ICP für Handwerksbetriebe 5–20 MA, die online keine Anfragen bekommen“",
    system: `Du bist Nadia, Market-Research-Analystin. Du schärfst das ideale Kundenprofil (ICP), benennst echte Schmerzpunkte, Kauftrigger und Botschaften und leitest daraus konkrete Angles ab. Strukturiert, priorisiert, umsetzbar. ${FORMAT_HINT}`,
  },
  {
    id: "cmo",
    name: "Jonas",
    role: "CMO / Strategie",
    emoji: "🎯",
    accent: "#b5852f",
    blurb: "Kampagnen- & Funnel-Strategie mit nächsten Schritten.",
    tasks: [
      "Funnel für ein neues Angebot",
      "30-Tage-Kampagnenplan",
      "Kanal-Mix-Empfehlung mit Budget-Logik",
    ],
    placeholder: "Ziel? z. B. „10 qualifizierte Calls/Monat für unser Retainer-Angebot, Budget knapp“",
    system: `Du bist Jonas, CMO der Agentur. Du entwirfst pragmatische Wachstumsstrategien: Funnel, Kanal-Mix, Kampagnen-Roadmap mit Meilensteinen und Messpunkten. Du denkst in Hebeln und nächsten Schritten, nicht in Theorie. ${FORMAT_HINT}`,
  },
  {
    id: "account",
    name: "Lena",
    role: "Account Manager",
    emoji: "🤝",
    accent: "#b5566f",
    blurb: "Kunden-Updates, Briefings & Angebote formulieren.",
    tasks: [
      "Wöchentliches Kunden-Update",
      "Briefing aus einem Konzept erstellen",
      "Angebots-Text für einen Interessenten",
    ],
    placeholder: "Wofür? z. B. „Status-Update für Kunde X: was lief, Zahlen, nächste Schritte“",
    system: `Du bist Lena, Account-Managerin. Du kommunizierst klar, verbindlich und nutzenorientiert mit Kunden: Updates, Briefings, Angebote. Freundlich-professioneller Ton, konkrete nächste Schritte, keine Floskeln. ${FORMAT_HINT}`,
  },
  {
    id: "analyst",
    name: "Sven",
    role: "Business Analyst",
    emoji: "📊",
    accent: "#5b6b7d",
    blurb: "Fasst Daten & Lage zusammen, zieht Schlüsse.",
    tasks: [
      "Wochen-Rückblick aus den Cockpit-Daten",
      "Wo verlieren wir Leads? Hypothesen",
      "3 Maßnahmen mit größtem Hebel",
    ],
    placeholder: "Frage? z. B. „Fasse unsere aktuelle Lage zusammen und nenne die 3 wichtigsten Hebel“",
    system: `Du bist Sven, Business-Analyst. Du verdichtest die vorhandenen Cockpit-Daten (Kunden, Konzepte, Automationen, Läufe) zu einer klaren Lagebeurteilung, erkennst Muster und empfiehlst priorisierte Maßnahmen. Nüchtern, konkret, mit Begründung. ${FORMAT_HINT}`,
  },
];

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

// Team-Aufträge: mehrere Agenten arbeiten nacheinander, jeder baut auf dem
// Ergebnis des vorigen auf. Schwerpunkt: Content & Outreach.
export type Pipeline = { id: string; name: string; blurb: string; steps: string[] };
export const PIPELINES: Pipeline[] = [
  { id: "campaign", name: "Kampagne aus dem Nichts", blurb: "Von der Recherche bis zur fertigen Outreach — alles in einem Lauf.", steps: ["research", "cmo", "content", "outreach"] },
  { id: "content-sprint", name: "Content-Sprint", blurb: "Recherche-gestützter, fertiger Content.", steps: ["research", "content"] },
  { id: "outreach-sprint", name: "Outreach-Sprint", blurb: "Zielkunden verstehen, dann persönliche Ansprache schreiben.", steps: ["research", "outreach"] },
  { id: "full", name: "Voll-Pipeline", blurb: "Strategie, Content, Outreach und Kunden-Briefing am Stück.", steps: ["research", "cmo", "content", "outreach", "account"] },
];

// grobe €-Schätzung pro 1M Tokens (in/out) je Modell — für die Kostenkachel.
const RATES: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 0.8, out: 4 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-opus-4-8": { in: 15, out: 75 },
};
function estimateCost(model: string, tin: number, tout: number): number {
  const r = RATES[model] ?? RATES["claude-sonnet-4-6"];
  return +(tin / 1e6 * r.in + tout / 1e6 * r.out).toFixed(4);
}

// Läuft einmal lazy: ergänzt bestehende DBs um die Spalte für den vollen Output
// (frische Installationen haben sie bereits aus 01-schema.sql).
let schemaReady: Promise<void> | null = null;
function ensureAgentSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS output text").then(() => undefined);
  }
  return schemaReady;
}

export type AgentResult = { output: string; model: string; tokensIn: number; tokensOut: number; costEur: number };

/** Führt einen Agenten echt aus (Claude + Cockpit-Kontext) und protokolliert den Lauf.
 *  priorWork = Ergebnisse vorheriger Team-Mitglieder (für Pipeline-Aufträge). */
export async function runAgent(agentId: string, task: string, model?: string, priorWork?: string): Promise<AgentResult> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error("Unbekannter Agent.");
  const client = await getClientAsync();
  if (!client) {
    return { output: "⚠️ Kein API-Schlüssel hinterlegt — trage ihn unter Einstellungen im Dashboard ein (oder in der .env).", model: "", tokensIn: 0, tokensOut: 0, costEur: 0 };
  }
  const usedModel = resolveModel(model);
  const context = await buildContext();
  const system = `${HK_BRIEF}\n\n${agent.system}\n\n# Kontext aus dem Cockpit (echte Daten — nutze sie)\n${context}`;
  const userMsg = priorWork
    ? `${task}\n\n# Bisherige Arbeit des Teams (baue darauf auf, wiederhole sie nicht)\n${priorWork}`
    : task;

  await ensureAgentSchema();
  // Lauf als "running" anlegen
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO agent_runs (automation, trigger, status, summary) VALUES ($1, 'agent', 'running', $2) RETURNING id",
    [`${agent.name} · ${agent.role}`, task.slice(0, 160)],
  );
  const runId = rows[0]?.id;

  try {
    const res = await client.messages.create({
      model: usedModel,
      max_tokens: 2000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    const output = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const tin = res.usage.input_tokens ?? 0;
    const tout = res.usage.output_tokens ?? 0;
    const costEur = estimateCost(usedModel, tin, tout);
    if (runId) {
      await pool.query(
        "UPDATE agent_runs SET status='success', finished_at=now(), tokens_in=$2, tokens_out=$3, cost_eur=$4, output=$5 WHERE id=$1",
        [runId, tin, tout, costEur, output],
      );
    }
    return { output, model: usedModel, tokensIn: tin, tokensOut: tout, costEur };
  } catch (err) {
    if (runId) {
      await pool.query("UPDATE agent_runs SET status='error', finished_at=now(), error=$2 WHERE id=$1", [
        runId,
        (err as Error).message.slice(0, 500),
      ]);
    }
    throw err;
  }
}

export type AgentStat = { today: number; total: number; running: number };

/** Lauf-Statistik je Agent (Schlüssel = Agent-Name · Rolle). */
export async function getAgentStats(): Promise<Record<string, AgentStat>> {
  const { rows } = await pool.query<{ automation: string; today: string; total: string; running: string }>(
    `SELECT automation,
            count(*) FILTER (WHERE started_at >= date_trunc('day', now())) AS today,
            count(*) AS total,
            count(*) FILTER (WHERE status = 'running') AS running
     FROM agent_runs WHERE trigger = 'agent' GROUP BY automation`,
  );
  const map: Record<string, AgentStat> = {};
  for (const r of rows) {
    map[r.automation] = { today: +r.today, total: +r.total, running: +r.running };
  }
  return map;
}

export type SavedOutput = {
  id: string;
  agentId: string; // aus dem Agent-Namen abgeleitet
  name: string;
  role: string;
  task: string;
  output: string;
  tokensOut: number;
  costEur: number;
  createdAt: string;
};

/** Die Agenten-Bibliothek: alle gespeicherten Outputs, neueste zuerst. */
export async function getSavedOutputs(opts: { agentName?: string; search?: string; limit?: number } = {}): Promise<SavedOutput[]> {
  await ensureAgentSchema();
  const where: string[] = ["trigger = 'agent'", "output IS NOT NULL", "output <> ''"];
  const params: unknown[] = [];
  if (opts.agentName) { params.push(opts.agentName); where.push(`automation = $${params.length}`); }
  if (opts.search?.trim()) { params.push(`%${opts.search.trim()}%`); where.push(`(summary ILIKE $${params.length} OR output ILIKE $${params.length})`); }
  params.push(Math.min(opts.limit ?? 100, 200));
  const { rows } = await pool.query<{ id: string; automation: string; summary: string | null; output: string; tokens_out: number; cost_eur: string; started_at: string }>(
    `SELECT id, automation, summary, output, tokens_out, cost_eur, started_at
     FROM agent_runs WHERE ${where.join(" AND ")}
     ORDER BY started_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => {
    const [name, role] = (r.automation ?? "").split(" · ");
    const agent = AGENTS.find((a) => a.name === name);
    return {
      id: r.id,
      agentId: agent?.id ?? "",
      name: name ?? r.automation ?? "Agent",
      role: role ?? "",
      task: r.summary ?? "",
      output: r.output,
      tokensOut: r.tokens_out ?? 0,
      costEur: +r.cost_eur || 0,
      createdAt: r.started_at,
    };
  });
}

/** Distinkte Agentennamen, die schon Outputs erzeugt haben (für den Filter). */
export async function getOutputAgents(): Promise<string[]> {
  await ensureAgentSchema();
  const { rows } = await pool.query<{ automation: string }>(
    "SELECT DISTINCT automation FROM agent_runs WHERE trigger='agent' AND output IS NOT NULL AND output <> '' ORDER BY automation",
  );
  return rows.map((r) => r.automation);
}

/** Löscht einen gespeicherten Output (Lauf). */
export async function deleteOutput(id: string): Promise<void> {
  await pool.query("DELETE FROM agent_runs WHERE id = $1", [id]);
}
