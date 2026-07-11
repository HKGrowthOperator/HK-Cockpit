"use client";

import { useEffect, useState } from "react";

type Status = { configured: boolean; source: "env" | "dashboard" | "none"; clientId: string; redirectUri: string };

export function GoogleSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/settings/google");
      const s: Status = await res.json();
      setStatus(s);
      setClientId(s.clientId || "");
      setRedirectUri(s.redirectUri || "");
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setNote(null);
    const res = await fetch("/api/settings/google", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", clientId, clientSecret, redirectUri }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.error) setNote({ ok: false, text: data.error });
    else { setStatus(data.status); setClientSecret(""); setNote({ ok: true, text: "Gespeichert. Jetzt unten „Mit Google verbinden“ klicken." }); }
    setBusy(false);
  }

  async function remove() {
    setBusy(true); setNote(null);
    const res = await fetch("/api/settings/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
    const data = await res.json().catch(() => ({}));
    setStatus(data.status); setClientId(""); setClientSecret(""); setNote({ ok: true, text: "Zugangsdaten entfernt." });
    setBusy(false);
  }

  const envLocked = status?.source === "env";

  return (
    <div className="bg-card border-border max-w-xl space-y-4 rounded-xl border p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-lg font-bold">Google Drive</h2>
        <p className="text-muted-foreground mt-1 text-sm">Optional — für den Import von Dokumenten aus deinem Drive. Zugangsdaten aus deiner Google-Cloud-App (OAuth-Client „Webanwendung“).</p>
      </div>

      <div className="bg-background border-border rounded-md border p-3 text-sm">
        {status == null ? "Status wird geladen…"
          : status.configured ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">eingerichtet</span>
              <span className="text-muted-foreground text-xs">Quelle: {status.source === "env" ? ".env-Datei" : "Dashboard"}</span>
            </span>
          ) : (
            <span className="rounded-full bg-[#c0532f]/15 px-2 py-0.5 text-xs font-semibold text-[#c0532f]">nicht eingerichtet</span>
          )}
      </div>

      {/* Redirect-URI zum Kopieren in die Google-Cloud-Konsole */}
      {status && (
        <div className="text-sm">
          <label className="text-muted-foreground text-xs">Diese Redirect-URI muss in deiner Google-Cloud-App als „Autorisierter Weiterleitungs-URI“ eingetragen sein:</label>
          <code className="bg-background border-border mt-1 block truncate rounded-md border px-2 py-1.5 font-mono text-xs">{redirectUri || "http://localhost:3000/api/google/callback"}</code>
        </div>
      )}

      {envLocked ? (
        <p className="text-muted-foreground text-xs">Aktuell aus der <code>.env</code> (hat Vorrang). Zum Verwalten hier bitte dort entfernen.</p>
      ) : (
        <div className="space-y-2">
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client-ID (…apps.googleusercontent.com)" autoComplete="off"
            className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none" />
          <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password" placeholder={status?.configured ? "Client-Secret (nur ändern, wenn nötig)" : "Client-Secret"} autoComplete="off"
            className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none" />
          <input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="Redirect-URI (leer = http://localhost:3000/api/google/callback)" autoComplete="off"
            className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={busy || !clientId.trim() || (!clientSecret.trim() && !status?.configured)}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-50">
              {busy ? "Speichert…" : "Speichern"}
            </button>
            {status?.source === "dashboard" && (
              <button type="button" onClick={remove} disabled={busy} className="text-muted-foreground hover:text-destructive rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50">Entfernen</button>
            )}
          </div>
        </div>
      )}

      {status?.configured && (
        <a href="/api/google/auth" className="bg-secondary hover:bg-secondary/80 inline-block rounded-md px-4 py-2 text-sm font-semibold">Mit Google verbinden →</a>
      )}

      {note && <p className={`text-sm ${note.ok ? "text-primary" : "text-[#c0532f]"}`}>{note.text}</p>}
    </div>
  );
}
