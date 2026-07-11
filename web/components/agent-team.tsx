"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveItem } from "@/app/actions";

export type ClientAgent = {
  id: string; name: string; role: string; emoji: string; accent: string;
  blurb: string; focus?: boolean; tasks: string[]; placeholder: string;
};
export type ClientPipeline = { id: string; name: string; blurb: string; steps: string[] };
type Stat = { today: number; total: number; running: number };
type Step = { agentId: string; status: "wartet" | "arbeitet" | "fertig" | "fehler"; output: string };

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku · schnell" },
  { id: "claude-sonnet-4-6", label: "Sonnet · ausgewogen" },
  { id: "claude-opus-4-8", label: "Opus · stark" },
];

export function AgentTeam({
  agents, pipelines, stats, aggregate,
}: {
  agents: ClientAgent[];
  pipelines: ClientPipeline[];
  stats: Record<string, Stat>;
  aggregate: { today: number; total: number; running: number };
}) {
  const router = useRouter();
  const byId = new Map(agents.map((a) => [a.id, a]));
  const [mode, setMode] = useState<"single" | "team">("single");
  const [active, setActive] = useState<ClientAgent | null>(null);
  const [task, setTask] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState<{ costEur: number; tokensOut: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Team-Auftrag (Pipeline)
  const [pipe, setPipe] = useState<ClientPipeline>(pipelines[0]);
  const [brief, setBrief] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2500); }
  function statFor(a: ClientAgent): Stat { return stats[`${a.name} · ${a.role}`] ?? { today: 0, total: 0, running: 0 }; }

  async function runPipeline() {
    if (!brief.trim() || running) return;
    setRunning(true);
    const init: Step[] = pipe.steps.map((id) => ({ agentId: id, status: "wartet", output: "" }));
    setSteps(init);
    let prior = "";
    for (let i = 0; i < pipe.steps.length; i++) {
      const agentId = pipe.steps[i];
      setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, status: "arbeitet" } : st)));
      try {
        const res = await fetch("/api/agents/run", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, task: brief, model, priorWork: prior || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.error) {
          setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, status: "fehler", output: data.error } : st)));
          break;
        }
        const out = data.output ?? "";
        const a = byId.get(agentId);
        prior += `\n### ${a?.role ?? agentId}\n${out}\n`;
        setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, status: "fertig", output: out } : st)));
      } catch {
        setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, status: "fehler", output: "Schritt fehlgeschlagen." } : st)));
        break;
      }
    }
    setRunning(false);
    router.refresh();
  }

  async function savePipelineResult() {
    const done = steps.filter((s) => s.status === "fertig");
    if (!done.length) return;
    const body = done.map((s) => `## ${byId.get(s.agentId)?.role ?? s.agentId}\n${s.output}`).join("\n\n");
    try {
      await saveItem({
        module: "templates", path: "/kundenbedienung",
        data: { title: `${pipe.name}: ${brief.slice(0, 50)}`, channel: "Chat", category: "Team-Auftrag", body },
      });
      flash("Als Vorlage gespeichert ✓");
    } catch { flash("Speichern fehlgeschlagen."); }
  }

  function open(a: ClientAgent) {
    setActive(a); setTask(""); setOutput(""); setMeta(null);
    setTimeout(() => document.getElementById("agent-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function run() {
    if (!active || !task.trim()) return;
    setBusy(true); setOutput(""); setMeta(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: active.id, task, model }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) flash(data.error);
      else { setOutput(data.output ?? ""); setMeta({ costEur: data.costEur ?? 0, tokensOut: data.tokensOut ?? 0 }); router.refresh(); }
    } catch { flash("Ausführung fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  async function saveAsTemplate() {
    if (!active || !output) return;
    const channel = active.id === "outreach" ? "E-Mail" : "Chat";
    try {
      await saveItem({
        module: "templates", path: "/kundenbedienung",
        data: { title: `${active.role}: ${task.slice(0, 60)}`, channel, category: active.role, body: output },
      });
      flash("Als Vorlage gespeichert ✓");
    } catch { flash("Speichern fehlgeschlagen."); }
  }

  return (
    <div className="space-y-6">
      {/* Kopf-Kennzahlen */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Aufträge heute" value={aggregate.today} />
        <StatTile label="Erledigt gesamt" value={aggregate.total} />
        <StatTile label="Gerade aktiv" value={aggregate.running} accent />
      </div>

      {/* Modus-Umschalter */}
      <div className="border-border inline-flex rounded-lg border p-1 text-sm">
        <button type="button" onClick={() => setMode("single")}
          className={`rounded-md px-3 py-1 font-semibold ${mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Einzelauftrag</button>
        <button type="button" onClick={() => setMode("team")}
          className={`rounded-md px-3 py-1 font-semibold ${mode === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Team-Auftrag</button>
      </div>

      {mode === "team" && (
        <section className="border-l-gold bg-card border-border space-y-4 rounded-xl border border-l-4 p-5 shadow-sm">
          <p className="text-muted-foreground text-sm">Mehrere Agenten arbeiten nacheinander — jeder baut auf dem Ergebnis des vorigen auf.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pipelines.map((p) => (
              <button key={p.id} type="button" onClick={() => setPipe(p)}
                className={`rounded-lg border p-3 text-left ${pipe.id === p.id ? "border-primary ring-primary ring-1" : "border-border hover:border-foreground/30"}`}>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {p.steps.map((id, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span>{byId.get(id)?.emoji}</span>{i < p.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                    </span>
                  ))}
                  <span className="ml-1">{p.name}</span>
                </div>
                <div className="text-muted-foreground mt-1 text-xs">{p.blurb}</div>
              </button>
            ))}
          </div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3}
            placeholder="Das Ziel in einem Satz, z. B. „Neukunden für unser Retainer-Angebot bei Handwerksbetrieben gewinnen.“"
            className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none" />
          <div className="flex items-center gap-2">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-background border-border rounded-md border px-2 py-1.5 text-xs">
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button type="button" onClick={runPipeline} disabled={running || !brief.trim()}
              className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-50">
              {running ? "Team arbeitet…" : "Pipeline starten"}
            </button>
            {steps.some((s) => s.status === "fertig") && !running && (
              <button type="button" onClick={savePipelineResult} className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Gesamt als Vorlage speichern</button>
            )}
          </div>
          {steps.length > 0 && (
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const a = byId.get(s.agentId);
                return (
                  <li key={i} className="border-border rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: (a?.accent ?? "#888") + "22" }}>{a?.emoji}</span>
                      <span>{a?.name}</span><span className="text-muted-foreground text-xs">{a?.role}</span>
                      <span className={`ml-auto text-xs ${s.status === "fehler" ? "text-destructive" : s.status === "fertig" ? "text-primary" : "text-muted-foreground"}`}>
                        {s.status === "arbeitet" ? "● arbeitet…" : s.status === "fertig" ? "✓ fertig" : s.status === "fehler" ? "Fehler" : "wartet"}
                      </span>
                    </div>
                    {s.output && <div className="bg-background border-border mt-2 max-h-72 overflow-auto rounded-md border p-3 text-sm whitespace-pre-wrap">{s.output}</div>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* Team-Karten */}
      {mode === "single" && (<>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const s = statFor(a);
          const isActive = active?.id === a.id;
          return (
            <button key={a.id} type="button" onClick={() => open(a)}
              className={`bg-card border-border hover:border-foreground/30 rounded-xl border p-4 text-left shadow-sm transition ${isActive ? "ring-primary ring-2" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                  style={{ backgroundColor: a.accent + "22" }}>{a.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate">{a.name}</strong>
                    {a.focus && <span className="bg-gold/15 text-gold-ink rounded-full px-1.5 py-0.5 text-[10px] font-semibold">Schwerpunkt</span>}
                  </div>
                  <div className="text-muted-foreground text-xs" style={{ color: a.accent }}>{a.role}</div>
                </div>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{a.blurb}</p>
              <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
                <span>heute <strong className="text-foreground">{s.today}</strong></span>
                <span>gesamt <strong className="text-foreground">{s.total}</strong></span>
                {s.running > 0 && <span className="text-primary">● aktiv</span>}
                <span className="ml-auto font-semibold" style={{ color: a.accent }}>Beauftragen →</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Arbeits-Panel */}
      {active && (
        <section id="agent-panel" className="border-l-gold bg-card border-border space-y-3 rounded-xl border border-l-4 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg" style={{ backgroundColor: active.accent + "22" }}>{active.emoji}</span>
            <div>
              <h2 className="font-serif text-lg font-bold">{active.name}</h2>
              <div className="text-xs" style={{ color: active.accent }}>{active.role}</div>
            </div>
            <button type="button" onClick={() => setActive(null)} className="text-muted-foreground hover:text-foreground ml-auto text-sm">✕</button>
          </div>

          <div className="flex flex-wrap gap-2">
            {active.tasks.map((t) => (
              <button key={t} type="button" onClick={() => setTask(t)}
                className="border-border bg-background hover:bg-secondary rounded-full border px-3 py-1 text-xs">{t}</button>
            ))}
          </div>

          <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} placeholder={active.placeholder}
            className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none" />

          <div className="flex items-center gap-2">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-background border-border rounded-md border px-2 py-1.5 text-xs">
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button type="button" onClick={run} disabled={busy || !task.trim()}
              className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-50">
              {busy ? "Arbeitet…" : "Ausführen"}
            </button>
          </div>

          {output && (
            <div className="space-y-2">
              <div className="bg-background border-border max-h-[480px] overflow-auto rounded-md border p-4 text-sm whitespace-pre-wrap">{output}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(output); flash("Kopiert ✓"); }}
                  className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Kopieren</button>
                <button type="button" onClick={saveAsTemplate}
                  className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Als Vorlage speichern</button>
                {meta && <span className="text-muted-foreground ml-auto text-xs">~{meta.costEur.toFixed(4)} € · {meta.tokensOut} Tokens</span>}
              </div>
            </div>
          )}
        </section>
      )}
      </>)}

      {toast && <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">{toast}</div>}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
      <div className={`font-serif text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
