// Prüft die Zuordnung Automation → n8n-Webhook und die Workflow-Dateien.
import { readFileSync, readdirSync } from "node:fs";
import { istStartbar, webhookUrl } from "@/lib/automations-run";

let fehler = 0;
const ok = (name: string, b: boolean, info = "") => {
  console.log(`${b ? "  OK  " : " FEHL "} ${name}${info ? " — " + info : ""}`);
  if (!b) fehler++;
};

console.log("\n── Startbarkeit ──");
ok("gültige Kennung", istStartbar("aut-lead-radar"));
ok("leer abgelehnt", !istStartbar(""));
ok("fremdes Format abgelehnt", !istStartbar("lead-radar"));
ok("Zahl abgelehnt", !istStartbar(42));

console.log("\n── Webhook-Adressen ──");
process.env.N8N_BASE_URL = "https://n8n.example.com/";
ok("Schrägstrich am Ende entfernt",
  webhookUrl("aut-lead-radar") === "https://n8n.example.com/webhook/hk/aut-lead-radar",
  webhookUrl("aut-lead-radar"));
ok("Testpfad", webhookUrl("aut-lead-radar", true).includes("/webhook-test/"));

console.log("\n── Workflow-Dateien ──");
const dir = "../n8n-workflows";
const dateien = readdirSync(dir).filter((f) => f.endsWith(".json"));
ok("31 Workflows", dateien.length === 31, String(dateien.length));

let mitHook = 0, pfadeOk = 0, idsOk = 0, verdrahtet = 0;
const pfade = new Set<string>();
for (const f of dateien) {
  const w = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  const id = f.replace(/\.json$/, "");
  const hook = w.nodes.find((n: { type: string }) => n.type === "n8n-nodes-base.webhook");
  if (hook) {
    mitHook++;
    if (hook.parameters.path === `hk/${id}`) pfadeOk++;
    pfade.add(hook.parameters.path);
  }
  if (w.id && /^[a-zA-Z0-9]{1,16}$/.test(w.id)) idsOk++;
  if (w.connections?.["Start aus dem Cockpit"]) verdrahtet++;
}
ok("alle mit Webhook", mitHook === 31, String(mitHook));
ok("Pfad = hk/<id>", pfadeOk === 31, String(pfadeOk));
ok("Pfade eindeutig", pfade.size === 31, String(pfade.size));
ok("alle mit gültiger ID", idsOk === 31, String(idsOk));
ok("Webhook verdrahtet", verdrahtet === 31, String(verdrahtet));

console.log("\n── Sammel-Datei ──");
const bundle = JSON.parse(readFileSync("../n8n-standalone/alle-31-workflows.json", "utf8"));
ok("31 Workflows gebündelt", bundle.length === 31, String(bundle.length));
ok("Sammel-Datei enthält Webhooks",
  bundle.every((w: { nodes: { type: string }[] }) =>
    w.nodes.some((n) => n.type === "n8n-nodes-base.webhook")));

console.log("\n── Katalog deckt Workflows ──");
const katalog = JSON.parse(readFileSync("lib/data/automations.json", "utf8"));
const katalogIds = new Set(katalog.map((a: { id: string }) => a.id));
const fehlend = dateien.map((f) => f.replace(/\.json$/, "")).filter((id) => !katalogIds.has(id));
ok("jede Workflow-Datei hat einen Katalog-Eintrag", fehlend.length === 0, fehlend.join(", "));
ok("jeder Katalog-Eintrag ist startbar", katalog.every((a: { id: string }) => istStartbar(a.id)));

// ── Rückkanal: keine eingebackenen Adressen oder Secrets ──
{
  console.log("\n── Rückkanal kommt zur Laufzeit ──");
  const dir2 = "../n8n-workflows";
  let ausEnv = 0, hartkodiert = 0;
  for (const f of readdirSync(dir2).filter((x) => x.endsWith(".json"))) {
    const roh = readFileSync(`${dir2}/${f}`, "utf8");
    if (roh.includes("$env.COCKPIT_LOG_URL") && roh.includes("$env.AUTOMATION_INGEST_SECRET")) ausEnv++;
    // Ein Secret-Wert im Klartext waere ein Leck — im Repo darf nur der Ausdruck stehen.
    if (/"x-automation-secret"\s*:\s*"[^"$]/.test(roh)) hartkodiert++;
  }
  ok("Adresse und Secret aus $env", ausEnv === 31, String(ausEnv));
  ok("kein Secret im Klartext", hartkodiert === 0, String(hartkodiert));

  const compose = readFileSync("../n8n-standalone/docker-compose.yaml", "utf8");
  ok("n8n erlaubt Env-Zugriff", compose.includes("N8N_BLOCK_ENV_ACCESS_IN_NODE=false"));

  console.log(`\n${fehler === 0 ? "Alle Prüfungen bestanden." : `${fehler} Prüfung(en) fehlgeschlagen.`}\n`);
  process.exit(fehler === 0 ? 0 : 1);
}
