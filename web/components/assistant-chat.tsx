"use client";

import { useRef, useState } from "react";
import { saveItem } from "@/app/actions";

type Proposal = {
  key: string;
  aktion: "anlegen" | "bearbeiten";
  modul: string;
  id?: string;
  titel: string;
  felder: Record<string, unknown>;
};
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku · günstig" },
  { id: "claude-sonnet-4-6", label: "Sonnet · ausgewogen" },
  { id: "claude-opus-4-8", label: "Opus · stark" },
];

const PATH: Record<string, string> = {
  sops: "/sops", clients: "/kundenbedienung", templates: "/kundenbedienung",
  concepts: "/konzepte", automations: "/automation", websites: "/webseiten",
  ai_updates: "/ai-intelligence", ai_experiments: "/ai-intelligence", ai_opportunities: "/ai-intelligence",
  ai_learning: "/ai-intelligence", ai_risks: "/ai-intelligence",
};
const MODUL_LABEL: Record<string, string> = {
  sops: "SOP", clients: "Kunde", templates: "Vorlage", concepts: "Konzept", automations: "Automation",
  websites: "Webseite", ai_updates: "AI-Update", ai_experiments: "Experiment", ai_opportunities: "Chance",
  ai_learning: "Begriff", ai_risks: "Risiko",
};

const QUICK = [
  { label: "Kundenmail entwerfen", prompt: "Entwirf eine freundliche, professionelle E-Mail an einen Kunden. Nutze passende Vorlagen und Kundendaten. Anlass: " },
  { label: "Neue SOP anlegen", prompt: "Lege eine neue SOP mit klaren, nummerierten Schritten an. Thema: " },
  { label: "Neuen Kunden anlegen", prompt: "Lege einen neuen Kunden an: " },
  { label: "AI-Updates → Maßnahmen", prompt: "Fasse die wichtigsten AI-Updates zu 3 konkreten, umsetzbaren Maßnahmen für uns zusammen." },
];

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply ?? data.error ?? "Es ist ein Fehler aufgetreten.";
      setMessages([...next, { role: "assistant", content: reply, proposals: data.proposals ?? [] }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Verbindung fehlgeschlagen. Bitte erneut versuchen." }]);
    } finally {
      setLoading(false);
    }
  }

  async function applyProposal(p: Proposal) {
    try {
      await saveItem({
        module: p.modul,
        path: PATH[p.modul] ?? "/",
        id: p.aktion === "bearbeiten" ? p.id : undefined,
        data: p.felder,
      });
      setApplied((s) => new Set(s).add(p.key));
      flash(p.aktion === "bearbeiten" ? "Änderung übernommen ✓" : "Angelegt ✓");
    } catch {
      flash("Speichern fehlgeschlagen");
    }
  }

  async function saveText(kind: "sop" | "template", content: string) {
    const title = content.split("\n").map((s) => s.trim()).filter(Boolean)[0]?.slice(0, 80) || "Assistent-Entwurf";
    try {
      if (kind === "sop")
        await saveItem({ module: "sops", path: "/sops", data: { title, area: "Assistent", summary: content, steps: [], tools: [], tags: ["assistent"] } });
      else await saveItem({ module: "templates", path: "/kundenbedienung", data: { title, channel: "E-Mail", category: "Assistent", body: content } });
      flash("Gespeichert ✓");
    } catch {
      flash("Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      {/* Kopf: Modellwahl */}
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs">
        <span>Modell:</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-card border-border rounded-md border px-2 py-1 text-xs"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <span className="hidden sm:inline">· günstiger spart dein Guthaben</span>
      </div>

      {/* Verlauf */}
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="text-muted-foreground mt-2 text-sm">
            <p className="mb-3">
              Frag mich etwas oder bitte mich, etwas anzulegen. Ich kenne deine Kunden, SOPs, Vorlagen, Konzepte und AI-Updates — und kann Einträge direkt vorschlagen.
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => { setInput(q.prompt); inputRef.current?.focus(); }}
                  className="border-border bg-card hover:bg-secondary rounded-full border px-3 py-1.5 text-xs font-semibold"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap"
                    : "max-w-[92%] space-y-3"
                }
              >
                {m.role === "assistant" ? (
                  <div className="bg-card border-border rounded-2xl rounded-bl-sm border px-4 py-3 text-sm whitespace-pre-wrap shadow-sm">
                    {m.content}
                    <div className="border-border mt-3 flex flex-wrap gap-2 border-t pt-2">
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(m.content); flash("Kopiert ✓"); }}
                        className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-semibold">Kopieren</button>
                      <button type="button" onClick={() => saveText("sop", m.content)}
                        className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-semibold">Als SOP speichern</button>
                      <button type="button" onClick={() => saveText("template", m.content)}
                        className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-semibold">Als Vorlage speichern</button>
                    </div>
                  </div>
                ) : (
                  m.content
                )}

                {/* Vorschläge des Assistenten */}
                {m.proposals?.map((p) => {
                  const isApplied = applied.has(p.key);
                  const isDiscarded = discarded.has(p.key);
                  if (isDiscarded) return null;
                  return (
                    <div key={p.key} className="border-l-gold bg-card border-border rounded-xl border border-l-4 p-4 text-sm shadow-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="bg-gold/15 text-gold-ink rounded-full px-2 py-0.5 text-xs font-semibold">
                          {p.aktion === "bearbeiten" ? "Ändern" : "Neu"} · {MODUL_LABEL[p.modul] ?? p.modul}
                        </span>
                        <strong>{p.titel}</strong>
                      </div>
                      <ul className="text-muted-foreground mb-3 list-disc pl-5 text-xs">
                        {Object.entries(p.felder).map(([k, v]) => (
                          <li key={k}>
                            <span className="font-medium">{k}:</span>{" "}
                            {Array.isArray(v) ? v.join(" · ") : String(v)}
                          </li>
                        ))}
                      </ul>
                      {isApplied ? (
                        <span className="text-primary text-xs font-semibold">✓ Übernommen</span>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => applyProposal(p)}
                            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-[#3a4734]">
                            ✓ Übernehmen
                          </button>
                          <button type="button" onClick={() => setDiscarded((s) => new Set(s).add(p.key))}
                            className="border-border text-muted-foreground hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">
                            Verwerfen
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {loading && <div className="text-muted-foreground text-sm">Assistent denkt nach…</div>}
      </div>

      {/* Eingabe */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-border bg-card sticky bottom-0 flex items-end gap-2 rounded-xl border p-2 shadow-sm"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
          placeholder={"Nachricht… z. B. ‚Leg den Kunden Müller GmbH an‘ (Enter senden, Shift+Enter neue Zeile)"}
          className="bg-background focus:ring-ring max-h-40 flex-1 resize-y rounded-md border-0 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-50"
        >
          Senden
        </button>
      </form>

      {toast && (
        <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
