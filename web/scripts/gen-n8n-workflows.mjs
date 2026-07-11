// Generiert aus lib/data/automations.json je einen n8n-Workflow (2.x-Format).
// Jeder Workflow: Manuell-Trigger + Zeitplan-Trigger -> HTTP-Request meldet den
// Lauf an den Cockpit-Rückkanal (/api/automations/log) => erscheint "live" im Dashboard.
// Ausgabe: ../n8n-workflows/<id>.json  (relativ zum Repo-Root)
//
// Nutzung (aus web/):
//   lokal (Dev-Server auf dem Host):   node scripts/gen-n8n-workflows.mjs
//   Server (Compose-Netz "hk-cockpit"): COCKPIT_LOG_URL=http://web:3000/api/automations/log \
//     AUTOMATION_INGEST_SECRET=<secret> node scripts/gen-n8n-workflows.mjs
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

// Ziel-URL des Rückkanals. Lokal: App auf dem Host. Server: Servicename im Compose-Netz.
const LOG_URL =
  process.env.COCKPIT_LOG_URL ?? "http://host.docker.internal:3001/api/automations/log";
// Auf dem Server Pflicht (Endpoint ist öffentlich erreichbar) — wird als Header mitgesendet.
const INGEST_SECRET = process.env.AUTOMATION_INGEST_SECRET ?? "";

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
  };

  const httpNode = {
    parameters: {
      method: "POST",
      url: LOG_URL,
      ...(INGEST_SECRET
        ? {
            sendHeaders: true,
            specifyHeaders: "json",
            jsonHeaders: JSON.stringify({ "x-automation-secret": INGEST_SECRET }),
          }
        : {}),
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
    name: `HK · ${a.title}`,
    nodes: [manualNode, scheduleNode, httpNode],
    connections: {
      "Manuell starten": { main: [[{ node: "An Cockpit melden", type: "main", index: 0 }]] },
      "Zeitplan": { main: [[{ node: "An Cockpit melden", type: "main", index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: "v1" },
    tags: [],
  };

  writeFileSync(resolve(outDir, `${a.id}.json`), JSON.stringify(workflow, null, 2));
  count++;
}

console.log(`✓ ${count} n8n-Workflows erzeugt in ${outDir}`);
