"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveItem, removeItem } from "@/app/actions";

type SavedReport = { id: string; client?: string; week?: string; date?: string; body?: string };

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku · günstig" },
  { id: "claude-sonnet-4-6", label: "Sonnet · ausgewogen" },
  { id: "claude-opus-4-8", label: "Opus · stark" },
];

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const today = () => new Date().toLocaleDateString("de-DE");

const input = "bg-card border-border focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none";

export function ReportStudio({ clients, reports }: { clients: { name: string }[]; reports: SavedReport[] }) {
  const router = useRouter();
  const [clientName, setClientName] = useState(clients[0]?.name ?? "");
  const [notes, setNotes] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2000); }

  async function generate() {
    if (!clientName || loading) return;
    setLoading(true); setError(null); setReport(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, notes, model }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.report) setReport(data.report);
      else setError(data.error ?? "Es ist ein Fehler aufgetreten.");
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!report) return;
    await saveItem({ module: "reports", path: "/berichte", data: { client: clientName, week: isoWeek(), date: today(), body: report } });
    setReport(null);
    flash("Bericht gespeichert ✓");
    router.refresh();
  }
  async function saveAsTemplate() {
    if (!report) return;
    await saveItem({ module: "templates", path: "/kundenbedienung", data: { title: `Wochenreport ${clientName}`, channel: "E-Mail", category: "Report", body: report } });
    flash("Als Vorlage gespeichert ✓");
  }
  async function del(id: string) {
    if (!window.confirm("Diesen Bericht löschen?")) return;
    await removeItem({ id, path: "/berichte" });
    flash("Gelöscht");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground text-sm">
        Wähle einen Kunden, wirf optional die Highlights der Woche rein — und erhalte einen fertigen, versandbereiten Wochenreport.
      </p>

      {/* Generator */}
      <section className="bg-card border-border rounded-xl border p-5 shadow-sm">
        {clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">Lege zuerst unter „Kundenbedienung" einen Kunden an.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs font-medium">Kunde</label>
                <select className={input} value={clientName} onChange={(e) => setClientName(e.target.value)}>
                  {clients.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs font-medium">Modell</label>
                <select className={input} value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium">Highlights dieser Woche (optional)</label>
              <textarea
                className={`${input} min-h-[90px] resize-y`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={"z. B. Landingpage live gegangen, 3 neue Leads, Kampagne gestartet …"}
              />
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-60"
            >
              {loading ? "Erstelle Bericht…" : "Bericht erstellen"}
            </button>
            {error && <p className="text-rust text-sm">{error}</p>}
          </div>
        )}
      </section>

      {/* Ergebnis */}
      {report && (
        <section className="border-l-gold bg-card border-border rounded-xl border border-l-4 p-5 shadow-sm">
          <h2 className="mb-2 font-serif text-lg font-bold">Entwurf für {clientName}</h2>
          <div className="bg-background border-border max-h-[420px] overflow-auto rounded-md border p-4 text-sm whitespace-pre-wrap">{report}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(report); flash("Kopiert ✓"); }}
              className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Kopieren</button>
            <button type="button" onClick={save}
              className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-[#3a4734]">Speichern</button>
            <button type="button" onClick={saveAsTemplate}
              className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Als Vorlage speichern</button>
            <button type="button" onClick={() => setReport(null)}
              className="border-border text-muted-foreground hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Verwerfen</button>
          </div>
        </section>
      )}

      {/* Gespeicherte Berichte */}
      <section>
        <h2 className="mb-3 font-serif text-lg font-bold">Gespeicherte Berichte</h2>
        {reports.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Berichte gespeichert.</p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(360px, 100%), 1fr))" }}>
            {reports.map((r) => (
              <article key={r.id} className="bg-card border-border flex flex-col gap-2 rounded-xl border p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-gold/15 text-gold-ink rounded-full px-2.5 py-0.5 text-xs font-semibold">{r.client || "Kunde"}</span>
                  {r.week && <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">{r.week}</span>}
                  {r.date && <span className="text-muted-foreground text-xs">{r.date}</span>}
                </div>
                <div className="bg-background border-border max-h-44 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">{r.body}</div>
                <div className="mt-auto flex gap-2 pt-1">
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(r.body ?? ""); flash("Kopiert ✓"); }}
                    className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Kopieren</button>
                  <button type="button" onClick={() => del(r.id)}
                    className="border-rust/40 text-rust hover:bg-rust/10 rounded-md border px-3 py-1.5 text-xs font-semibold">Löschen</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {toast && (
        <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">{toast}</div>
      )}
    </div>
  );
}
