"use client";

import { useMemo, useState } from "react";
import { saveItem, removeOutput } from "@/app/actions";

type Output = {
  id: string; agentId: string; name: string; role: string; task: string;
  output: string; tokensOut: number; costEur: number; createdAt: string;
};
type AgentMeta = { id: string; name: string; role: string; emoji: string; accent: string };

export function AgentLibrary({ outputs, agents }: { outputs: Output[]; agents: AgentMeta[] }) {
  const metaById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const metaByName = useMemo(() => new Map(agents.map((a) => [a.name, a])), [agents]);
  const meta = (o: Output) => metaById.get(o.agentId) ?? metaByName.get(o.name);

  const [items, setItems] = useState(outputs);
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2500); }

  // Agenten, die tatsächlich Outputs haben (für den Filter)
  const presentAgents = useMemo(() => {
    const ids = new Set(items.map((o) => o.agentId).filter(Boolean));
    return agents.filter((a) => ids.has(a.id));
  }, [items, agents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((o) => {
      if (agentFilter !== "all" && o.agentId !== agentFilter) return false;
      if (q && !(o.task.toLowerCase().includes(q) || o.output.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [items, agentFilter, search]);

  function toggle(id: string) {
    setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function saveTemplate(o: Output) {
    try {
      await saveItem({
        module: "templates", path: "/kundenbedienung",
        data: { title: `${o.role}: ${o.task.slice(0, 60)}`, channel: o.agentId === "outreach" ? "E-Mail" : "Chat", category: o.role, body: o.output },
      });
      flash("Als Vorlage gespeichert ✓");
    } catch { flash("Speichern fehlgeschlagen."); }
  }

  async function del(o: Output) {
    setItems((s) => s.filter((x) => x.id !== o.id));
    try { await removeOutput({ id: o.id }); } catch { flash("Löschen fehlgeschlagen."); }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {/* Filterleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="bg-background border-border rounded-md border px-2 py-2 text-sm">
          <option value="all">Alle Agenten</option>
          {presentAgents.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name} · {a.role}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="In Outputs suchen…"
          className="bg-background border-border focus:ring-ring min-w-[12rem] flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none" />
        <span className="text-muted-foreground text-sm">{filtered.length} von {items.length}</span>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {items.length === 0 ? "Noch keine Outputs. Beauftrage im Agenten-Team einen Agenten — jedes Ergebnis landet automatisch hier." : "Keine Treffer für diesen Filter."}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((o) => {
          const m = meta(o);
          const isOpen = open.has(o.id);
          const preview = o.output.length > 280 && !isOpen ? o.output.slice(0, 280) + "…" : o.output;
          return (
            <div key={o.id} className="bg-card border-border rounded-xl border p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg" style={{ backgroundColor: (m?.accent ?? "#888") + "22" }}>{m?.emoji ?? "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <strong>{o.name}</strong>
                    <span className="text-xs" style={{ color: m?.accent }}>{o.role}</span>
                    <span className="text-muted-foreground ml-auto text-xs">{fmt(o.createdAt)}</span>
                  </div>
                  {o.task && <div className="text-muted-foreground mt-0.5 text-sm">{o.task}</div>}
                </div>
              </div>
              <div className="bg-background border-border mt-2 rounded-md border p-3 text-sm whitespace-pre-wrap">{preview}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {o.output.length > 280 && (
                  <button type="button" onClick={() => toggle(o.id)} className="text-primary text-xs font-semibold">{isOpen ? "weniger" : "mehr anzeigen"}</button>
                )}
                <button type="button" onClick={() => { navigator.clipboard?.writeText(o.output); flash("Kopiert ✓"); }} className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-semibold">Kopieren</button>
                <button type="button" onClick={() => saveTemplate(o)} className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-semibold">Als Vorlage</button>
                <button type="button" onClick={() => del(o)} className="text-muted-foreground hover:text-destructive ml-auto rounded-md px-2.5 py-1 text-xs font-semibold">Löschen</button>
                {o.costEur > 0 && <span className="text-muted-foreground text-xs">~{o.costEur.toFixed(4)} €</span>}
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">{toast}</div>}
    </div>
  );
}
