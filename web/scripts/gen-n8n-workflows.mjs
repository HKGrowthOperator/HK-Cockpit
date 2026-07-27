// Generiert aus lib/data/automations.json je einen n8n-Workflow (2.x-Format).
// Jeder Workflow: Webhook- + Manuell- + Zeitplan-Trigger -> HTTP-Request meldet den
// Lauf an den Cockpit-Rückkanal (/api/automations/log) => erscheint "live" im Dashboard.
//
// Der Webhook ist der Weg für den "Jetzt starten"-Knopf im Cockpit: Die App ruft
// POST <n8n>/webhook/hk/<automation-id> auf. Ohne Webhook liesse sich ein
// Workflow von aussen nicht ausloesen - die n8n-API kann Workflows nicht starten.
// Ausgabe: ../n8n-workflows/<id>.json  (relativ zum Repo-Root)
//
// Adresse des Rueckkanals und das Secret werden NICHT eingebacken, sondern zur
// Laufzeit aus den n8n-Umgebungsvariablen gelesen (COCKPIT_LOG_URL,
// AUTOMATION_INGEST_SECRET). Zwei Gruende:
//   1. Die Adresse aendert sich beim Umzug/Redeploy - eingebacken zeigt sie ins Leere.
//   2. Das Secret gehoert nicht in ein Repository.
// Voraussetzung: n8n laeuft mit N8N_BLOCK_ENV_ACCESS_IN_NODE=false (siehe
// n8n-standalone/docker-compose.yaml), sonst sieht ein Node keine Env-Variablen.
//
// Nutzung (aus web/):
//   node scripts/gen-n8n-workflows.mjs
// Danach in n8n importieren:
//   docker exec hk-n8n n8n import:workflow --separate --input=<pfad>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "..");
const outDir = resolve(repoRoot, "n8n-workflows");
mkdirSync(outDir, { recursive: true });

// n8n-Ausdruecke: werden erst beim Lauf ausgewertet, nicht beim Erzeugen.
// Fallback auf den lokalen Dev-Server, falls die Variable in n8n fehlt.
const LOG_URL =
  '={{ $env.COCKPIT_LOG_URL || "http://host.docker.internal:3001/api/automations/log" }}';
const SECRET_HEADER = '={{ { "x-automation-secret": $env.AUTOMATION_INGEST_SECRET || "" } }}';

const automations = JSON.parse(
  readFileSync(resolve(webRoot, "lib/data/automations.json"), "utf8"),
);

// Grobe Kadenz aus dem Trigger-Text ableiten (Luis justiert pro Automation nach).
function scheduleRule(trigger) {
  const t = (trigger || "").toLowerCase();
  if (/wöch|woch|freitag|montag|wroch/.test(t)) return { interval: [{ field: "weeks", weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 9 }] };
  if (/monat|30 tage/.test(t)) return { interval: [{ field: "months", monthsInterval: 1, triggerAtDayOfMonth: 1, triggerAtHour: 9 }] };
  if (/täg|06:00|06 uhr|daily/.test(t)) return { interval: [{ field: "days", daysInterval: 1, triggerAtHour: 6 }] };
  return { interval: [{ field: "days", daysInterval: 1, triggerAtHour: 9 }] };
}

// "Event"-artige Auslöser (Formular, Deal gewonnen, Vertrag) laufen real per Webhook/Event.
function triggerKind(trigger) {
  const t = (trigger || "").toLowerCase();
  if (/formular|e-mail|eingehend|deal|vertrag|gewonnen|unterschrieben|transkript|meilenstein|url ins cockpit|wirft/.test(t)) return "event";
  return "schedule";
}

let count = 0;
for (const a of automations) {
  const kind = triggerKind(a.trigger);
  const body = {
    automation: a.title,
    trigger: kind,
    status: "success",
    summary: "Lauf gemeldet — Workflow-Skelett aktiv; echte Tool-Aktionen folgen.",
    automation_id: a.id,
  };

  const httpNode = {
    parameters: {
      method: "POST",
      url: LOG_URL,
      sendHeaders: true,
      specifyHeaders: "json",
      jsonHeaders: SECRET_HEADER,
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: JSON.stringify(body, null, 2),
      options: {},
    },
    id: `${a.id}-http`,
    name: "An Cockpit melden",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [420, 200],
  };

  // Webhook: macht den Workflow von aussen startbar (Knopf im Cockpit).
  // Pfad ist stabil an die Automations-ID gebunden, damit die App ihn kennt.
  const webhookNode = {
    parameters: {
      httpMethod: "POST",
      path: `hk/${a.id}`,
      responseMode: "lastNode",
      options: {},
    },
    id: `${a.id}-hook`,
    name: "Start aus dem Cockpit",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [160, -60],
    webhookId: a.id,
  };

  const manualNode = {
    parameters: {},
    id: `${a.id}-manual`,
    name: "Manuell starten",
    type: "n8n-nodes-base.manualTrigger",
    typeVersion: 1,
    position: [160, 120],
  };

  const scheduleNode = {
    parameters: { rule: scheduleRule(a.trigger) },
    id: `${a.id}-sched`,
    name: "Zeitplan",
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position: [160, 300],
  };

  const workflow = {
    // Feste ID: n8n verlangt sie beim Import, und ein erneuter Import
    // ueberschreibt damit den vorhandenen Workflow statt ihn zu duplizieren.
    id: a.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16),
    name: `HK · ${a.title}`,
    nodes: [webhookNode, manualNode, scheduleNode, httpNode],
    connections: {
      "Start aus dem Cockpit": { main: [[{ node: "An Cockpit melden", type: "main", index: 0 }]] },
      "Manuell starten": { main: [[{ node: "An Cockpit melden", type: "main", index: 0 }]] },
      "Zeitplan": { main: [[{ node: "An Cockpit melden", type: "main", index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: "v1" },
  };

  writeFileSync(resolve(outDir, `${a.id}.json`), JSON.stringify(workflow, null, 2));
  count++;
}

console.log(`✓ ${count} n8n-Workflows erzeugt in ${outDir}`);
