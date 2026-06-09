"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProposalCards, type Proposal } from "@/components/proposal-cards";

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string };

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku · günstig" },
  { id: "claude-sonnet-4-6", label: "Sonnet · ausgewogen" },
  { id: "claude-opus-4-8", label: "Opus · stark" },
];

function typeLabel(mime: string): string {
  if (mime === "application/vnd.google-apps.document") return "Doc";
  if (mime === "application/vnd.google-apps.spreadsheet") return "Sheet";
  if (mime === "application/vnd.google-apps.presentation") return "Slides";
  if (mime === "application/vnd.google-apps.folder") return "Ordner";
  if (mime.startsWith("image/")) return "Bild";
  if (mime === "application/pdf") return "PDF";
  return mime.split(/[/.]/).pop() ?? "Datei";
}

export function DriveBrowser({
  configured,
  connected,
  email,
  notice,
}: {
  configured: boolean;
  connected: boolean;
  email?: string;
  notice?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [importing, setImporting] = useState<string | null>(null);
  const [result, setResult] = useState<{ fileName: string; reply: string; proposals: Proposal[]; excerpt: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [banner] = useState<string | null>(notice ?? null);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2500); }

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/google/files?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      setFiles(data.files ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) load("");
  }, [connected, load]);

  async function importFile(f: DriveFile) {
    setImporting(f.id);
    setResult(null);
    try {
      const res = await fetch("/api/google/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: f.id, mimeType: f.mimeType, model }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) flash(data.error);
      else setResult({ fileName: f.name, reply: data.reply ?? "", proposals: data.proposals ?? [], excerpt: data.excerpt ?? "" });
    } catch {
      flash("Import fehlgeschlagen.");
    } finally {
      setImporting(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Verbindung zu Google Drive trennen?")) return;
    await fetch("/api/google/disconnect", { method: "POST" });
    router.refresh();
  }

  // ── nicht eingerichtet ────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="space-y-3">
        {banner && <Banner text={banner} />}
        <div className="bg-card border-border rounded-xl border p-6 text-sm shadow-sm">
          <h2 className="mb-2 font-serif text-lg font-bold">Google-Anbindung noch nicht eingerichtet</h2>
          <p className="text-muted-foreground">
            Es fehlen <code>GOOGLE_CLIENT_ID</code> und <code>GOOGLE_CLIENT_SECRET</code> in der <code>.env</code>.
            Folge der Einrichtungsanleitung (Google-Cloud-App erstellen), trage die Werte ein und starte den Web-Container neu.
          </p>
        </div>
      </div>
    );
  }

  // ── nicht verbunden ───────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="space-y-3">
        {banner && <Banner text={banner} />}
        <div className="bg-card border-border rounded-xl border p-6 text-sm shadow-sm">
          <h2 className="mb-2 font-serif text-lg font-bold">Mit Google Drive verbinden</h2>
          <p className="text-muted-foreground mb-4">
            Verbinde dein Google-Konto, um deine Dateien zu durchsuchen und Inhalte als OS-Einträge zu importieren (nur Lesezugriff).
          </p>
          <a href="/api/google/auth" className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734]">
            Mit Google verbinden
          </a>
        </div>
      </div>
    );
  }

  // ── verbunden ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {toast && <Banner text={toast} />}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-primary font-semibold">✓ Verbunden{email ? ` als ${email}` : ""}</span>
        <div className="flex-1" />
        <label className="text-muted-foreground text-xs">Modell:</label>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-card border-border rounded-md border px-2 py-1 text-xs">
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button type="button" onClick={disconnect} className="border-border text-muted-foreground hover:text-foreground rounded-md border px-3 py-1 text-xs">Trennen</button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(query); }} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Dateien suchen… (Name)"
          className="bg-card border-border focus:ring-ring w-full max-w-sm rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
        <button type="submit" className="border-border bg-card hover:bg-secondary rounded-md border px-3 py-2 text-sm font-semibold">Suchen</button>
      </form>

      {/* Ergebnis eines Imports */}
      {result && (
        <section className="border-l-gold bg-card border-border space-y-3 rounded-xl border border-l-4 p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold">Import: {result.fileName}</h2>
          {result.reply && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{result.reply}</p>}
          {result.proposals.length ? (
            <ProposalCards proposals={result.proposals} flash={flash} />
          ) : (
            <p className="text-muted-foreground text-sm">Keine passenden Einträge erkannt. Auszug:</p>
          )}
          {!result.proposals.length && result.excerpt && (
            <pre className="bg-background border-border max-h-40 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">{result.excerpt}</pre>
          )}
          <button type="button" onClick={() => setResult(null)} className="border-border text-muted-foreground hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold">Schließen</button>
        </section>
      )}

      {/* Dateiliste */}
      <section>
        {loading ? (
          <p className="text-muted-foreground text-sm">Lade Dateien…</p>
        ) : files.length === 0 ? (
          <p className="text-muted-foreground text-sm">Keine Dateien gefunden.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-muted-foreground text-left">
                <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Typ</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-border/60 border-t">
                    <td className="px-4 py-2">{f.name}</td>
                    <td className="px-4 py-2"><span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs">{typeLabel(f.mimeType)}</span></td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        {f.webViewLink && (
                          <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-semibold">Öffnen</a>
                        )}
                        <button type="button" disabled={importing === f.id} onClick={() => importFile(f)}
                          className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-[#3a4734] disabled:opacity-50">
                          {importing === f.id ? "Importiere…" : "Importieren"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast && <FloatingToast text={toast} />}
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return <div className="bg-gold/15 text-gold-ink border-gold/30 rounded-md border px-4 py-2 text-sm">{text}</div>;
}
function FloatingToast({ text }: { text: string }) {
  return <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">{text}</div>;
}
