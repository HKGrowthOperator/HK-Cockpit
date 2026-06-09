// lib/assistant.ts — server-side helper for the in-app Claude assistant.
// Builds a compact snapshot of all module data, exposes a tool the model uses
// to PROPOSE create/edit actions (the user confirms them in the UI), and wraps
// the official @anthropic-ai/sdk.
import Anthropic from "@anthropic-ai/sdk";
import { listItems } from "./store";
import { MODULES, MODULE_KEYS } from "./modules";
import { getSecret } from "./secrets";
import { HK_BRIEF } from "./hk";

export const API_KEY_SECRET = "anthropic_api_key";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Auswählbare Modelle (Preis steigt von oben nach unten).
export const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "claude-haiku-4-5", label: "Haiku — günstig & schnell" },
  { id: "claude-sonnet-4-6", label: "Sonnet — ausgewogen" },
  { id: "claude-opus-4-8", label: "Opus — am stärksten" },
];
// Budgetfreundlicher Standard; per ANTHROPIC_MODEL überschreibbar.
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export function resolveModel(m?: string): string {
  return m && MODEL_OPTIONS.some((o) => o.id === m) ? m : DEFAULT_MODEL;
}

/** Returns an Anthropic client from the env key only (sync, legacy). */
export function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

/** Der aktive Schlüssel: .env hat Vorrang, sonst der im Dashboard hinterlegte. */
export async function getApiKey(): Promise<string | null> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;
  const dbKey = await getSecret<string>(API_KEY_SECRET);
  return dbKey && dbKey.trim() ? dbKey.trim() : null;
}

/** Woher der Schlüssel kommt — für die Einstellungen-Anzeige (ohne ihn preiszugeben). */
export async function getApiKeyStatus(): Promise<{ configured: boolean; source: "env" | "dashboard" | "none"; masked: string | null }> {
  if (process.env.ANTHROPIC_API_KEY) return { configured: true, source: "env", masked: mask(process.env.ANTHROPIC_API_KEY) };
  const dbKey = await getSecret<string>(API_KEY_SECRET);
  if (dbKey && dbKey.trim()) return { configured: true, source: "dashboard", masked: mask(dbKey.trim()) };
  return { configured: false, source: "none", masked: null };
}

function mask(k: string): string {
  return k.length <= 12 ? "••••" : `${k.slice(0, 7)}…${k.slice(-4)}`;
}

/** Anthropic-Client aus .env ODER Dashboard-Schlüssel. */
export async function getClientAsync(): Promise<Anthropic | null> {
  const apiKey = await getApiKey();
  return apiKey ? new Anthropic({ apiKey }) : null;
}

/** Snapshot aller Daten (inkl. Zeilen-ID, damit Bearbeiten-Vorschläge möglich sind). */
export async function buildContext(): Promise<string> {
  const parts: string[] = [];
  for (const key of MODULE_KEYS) {
    const items = await listItems(key);
    if (!items.length) continue;
    const lines = items.map((it) => `- [${it.id}] ${JSON.stringify(it.data)}`);
    parts.push(`## ${MODULES[key].label} (${key})\n${lines.join("\n")}`);
  }
  return parts.join("\n\n") || "(noch keine Daten erfasst)";
}

/** Kompakter Leitfaden: welche Felder (und Auswahlwerte) jedes Modul hat. */
export function fieldGuide(): string {
  return MODULE_KEYS.map((k) => {
    const m = MODULES[k];
    const fields = m.fields
      .map((f) => (f.options ? `${f.name}(${f.options.join("|")})` : f.name))
      .join(", ");
    return `- ${k} (${m.label}): ${fields}`;
  }).join("\n");
}

// Die Spezialisten des Teams, an die der Assistent delegieren kann.
export const AGENT_IDS = ["content", "outreach", "research", "cmo", "account", "analyst"] as const;

// Werkzeuge des Assistenten: Aktionen vorschlagen + ans Team delegieren.
export const OS_TOOLS: Anthropic.Tool[] = [
  {
    name: "os_vorschlag",
    description:
      "Schlägt vor, einen Eintrag im OS anzulegen oder zu ändern. Der Nutzer bestätigt den Vorschlag per Klick. Nutze dieses Werkzeug, wann immer der Nutzer dich bittet, etwas anzulegen, zu erstellen, hinzuzufügen oder zu ändern — statt die Daten nur als Text auszugeben. Du darfst mehrere Vorschläge in einer Antwort machen.",
    input_schema: {
      type: "object",
      properties: {
        aktion: { type: "string", enum: ["anlegen", "bearbeiten"], description: "anlegen = neuer Eintrag, bearbeiten = bestehenden ändern" },
        modul: { type: "string", enum: MODULE_KEYS, description: "Ziel-Modul (Schlüssel aus der Modul-Liste)" },
        id: { type: "string", description: "Nur bei 'bearbeiten': die [id] des Eintrags aus den aktuellen Daten." },
        titel: { type: "string", description: "Kurzer, sprechender Titel des Vorschlags für die Anzeige." },
        felder: { type: "object", description: "Die Feldwerte passend zu den Feldern des Moduls. Listen (Schritte/Werkzeuge/Schlagwörter) als Array von Strings. Auswahlwerte exakt wie in der Feldliste (deutsch)." },
      },
      required: ["aktion", "modul", "titel", "felder"],
    },
  },
  {
    name: "team_beauftragen",
    description:
      "Delegiert eine konkrete Schreib- oder Recherche-Aufgabe an einen Spezialisten-Agenten des Teams und liefert dir dessen fertiges Ergebnis zurück. Nutze das, wenn der Nutzer fertigen Content, Cold-Mails, Recherche oder Strategie will — statt es selbst grob zu skizzieren. Du darfst auch mehrere Agenten in einer Antwort beauftragen. Das Ergebnis kommt zurück; fasse es dem Nutzer dann kurz zusammen oder gib es aus.",
    input_schema: {
      type: "object",
      properties: {
        agent: { type: "string", enum: [...AGENT_IDS], description: "content = Social-Posts/Hooks; outreach = Cold-Mails/DMs/Follow-ups; research = ICP/Markt/Wettbewerb; cmo = Strategie/Funnel/Kampagne; account = Kunden-Updates/Briefings/Angebote; analyst = Auswertung/Lagebild aus den Daten" },
        auftrag: { type: "string", description: "Die konkrete Aufgabe für den Agenten in ein bis zwei Sätzen, mit allem nötigen Kontext." },
      },
      required: ["agent", "auftrag"],
    },
  },
];

export const SYSTEM_PREAMBLE = `Du bist der HK-Growth-Assistent — der eingebaute Mitdenker und Macher im Betriebs-Cockpit einer Wachstumsagentur.

Du kennst die aktuellen Daten des Unternehmens (Kunden, SOPs, Vorlagen, Konzepte, Automationen, Webseiten, AI-Intelligence) und nutzt sie.

Du kannst:
- Echte Arbeit entwerfen: Kundenmails aus Vorlagen + Kontext, SOPs, Konzepte, Zusammenfassungen.
- Einträge ANLEGEN oder ÄNDERN: Nutze dafür das Werkzeug "os_vorschlag" mit den passenden Feldern. Der Nutzer bestätigt jeden Vorschlag selbst.
- Ans TEAM DELEGIEREN: Für fertigen Content, Cold-Mails, Recherche oder Strategie rufe das Werkzeug "team_beauftragen" auf (Agenten: content, outreach, research, cmo, account, analyst). Du bekommst das Ergebnis zurück und gibst es dem Nutzer.

Regeln:
- Antworte auf Deutsch, konkret und ohne lange Vorrede.
- Wenn der Nutzer etwas anlegen/ändern will, RUFE das Werkzeug auf (statt die Felder nur als Text zu schreiben). Fülle alle sinnvollen Felder; bei "bearbeiten" die [id] aus den Daten nutzen.
- Auswahl-/Status-Werte exakt wie in der Feldliste (deutsch, z. B. Kunden-Status: aktiv/Interessent/pausiert/verloren).
- Erfinde keine Kunden/Fakten, die nicht in den Daten stehen.
- Bei reinen Fragen oder Entwürfen ohne Speicherwunsch: einfach antworten, kein Werkzeug.`;

/** Baut den vollständigen System-Prompt (cachebar). */
export async function buildSystem(): Promise<string> {
  const [guide, context] = [fieldGuide(), await buildContext()];
  return `${SYSTEM_PREAMBLE}\n\n${HK_BRIEF}\n\n# Module & Felder\n${guide}\n\n# Aktuelle Daten\n${context}`;
}

export type Proposal = {
  key: string;
  aktion: "anlegen" | "bearbeiten";
  modul: string;
  id?: string;
  titel: string;
  felder: Record<string, unknown>;
};

/** Zentraler Assistenten-Aufruf: liefert Antworttext + Aktions-Vorschläge. */
export async function runAssistant(
  messages: ChatMessage[],
  model?: string,
): Promise<{ reply: string; proposals: Proposal[] }> {
  const client = await getClientAsync();
  if (!client) {
    return {
      reply:
        "⚠️ Es ist noch kein Anthropic-API-Schlüssel hinterlegt. Trage ihn unter Einstellungen im Dashboard ein (oder als ANTHROPIC_API_KEY in die .env).",
      proposals: [],
    };
  }
  const usedModel = resolveModel(model);
  const system = await buildSystem();
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const proposals: Proposal[] = [];
  const texts: string[] = [];
  let agentCalls = 0;
  const MAX_AGENT_CALLS = 4;

  // Werkzeug-Schleife: os_vorschlag = Vorschlag (terminal), team_beauftragen = sofort
  // ausführen und Ergebnis an das Modell zurückgeben, damit es darauf aufbauen kann.
  for (let turn = 0; turn < 4; turn++) {
    const response = await client.messages.create({
      model: usedModel,
      max_tokens: 4000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: OS_TOOLS,
      messages: convo,
    });

    const t = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (t) texts.push(t);

    for (const b of response.content) {
      if (b.type === "tool_use" && b.name === "os_vorschlag") {
        const inp = b.input as Partial<Proposal>;
        const p: Proposal = {
          key: b.id,
          aktion: inp.aktion === "bearbeiten" ? "bearbeiten" : "anlegen",
          modul: String(inp.modul ?? ""),
          id: inp.id ? String(inp.id) : undefined,
          titel: String(inp.titel ?? "Vorschlag"),
          felder: (inp.felder as Record<string, unknown>) ?? {},
        };
        if (p.modul && p.felder && Object.keys(p.felder).length > 0) proposals.push(p);
      }
    }

    const teamBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "team_beauftragen",
    );
    // Ohne Delegation sind wir fertig (Vorschläge sind terminal, wie bisher).
    if (teamBlocks.length === 0) break;

    // Alle tool_use-Blöcke MÜSSEN beantwortet werden, sonst lehnt die API ab.
    convo.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    const { runAgent } = await import("./agents");
    for (const b of response.content) {
      if (b.type !== "tool_use") continue;
      if (b.name === "team_beauftragen") {
        const inp = b.input as { agent?: string; auftrag?: string };
        if (agentCalls >= MAX_AGENT_CALLS) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: "Limit an Team-Aufträgen erreicht — bitte einzeln nachfragen.", is_error: true });
          continue;
        }
        agentCalls++;
        try {
          const r = await runAgent(String(inp.agent ?? ""), String(inp.auftrag ?? ""), usedModel);
          results.push({ type: "tool_result", tool_use_id: b.id, content: r.output || "(kein Ergebnis)" });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: `Fehler: ${(err as Error).message}`, is_error: true });
        }
      } else {
        // os_vorschlag: dem Modell mitteilen, dass der Vorschlag dem Nutzer angezeigt wurde.
        results.push({ type: "tool_result", tool_use_id: b.id, content: "Vorschlag wurde dem Nutzer zur Bestätigung angezeigt." });
      }
    }
    convo.push({ role: "user", content: results });
  }

  return { reply: texts.join("\n\n").trim(), proposals };
}

/** Wandelt beliebigen Text (z. B. aus Google Drive) in Eintrags-Vorschläge um. */
export async function proposeFromText(text: string, model?: string) {
  return runAssistant(
    [
      {
        role: "user",
        content:
          "Wandle den folgenden Inhalt aus Google Drive in passende OS-Einträge um. Nutze das Werkzeug os_vorschlag für jeden sinnvollen Eintrag (Anleitung/Prozess → SOP, Kundeninfos → Kunde, Angebot/Strategie/Kampagne → Konzept, Textbaustein/E-Mail → Vorlage, Projekt/Website → Webseite). Lege keine Dubletten zu bereits vorhandenen Einträgen an. Fasse dich im Antworttext kurz.\n\n--- INHALT ---\n" +
          text,
      },
    ],
    model,
  );
}
