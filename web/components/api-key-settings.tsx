"use client";

import { useEffect, useState } from "react";

type Status = { configured: boolean; source: "env" | "dashboard" | "none"; masked: string | null };

export function ApiKeySettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/settings/api-key");
      setStatus(await res.json());
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/settings/api-key", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    return res.json().catch(() => ({}));
  }

  async function save() {
    if (!key.trim()) return;
    setBusy("save"); setNote(null);
    const data = await post("save", { key });
    if (data.error) setNote({ ok: false, text: data.error });
    else { setStatus(data.status); setKey(""); setNote({ ok: true, text: "Schlüssel gespeichert. Teste jetzt die Verbindung." }); }
    setBusy(null);
  }

  async function test() {
    setBusy("test"); setNote(null);
    const data = await post("test");
    setNote(data.ok ? { ok: true, text: "✓ Verbindung erfolgreich — die Agenten können loslegen." } : { ok: false, text: data.error || "Test fehlgeschlagen." });
    setBusy(null);
  }

  async function remove() {
    setBusy("delete"); setNote(null);
    const data = await post("delete");
    setStatus(data.status); setNote({ ok: true, text: "Schlüssel entfernt." });
    setBusy(null);
  }

  const envLocked = status?.source === "env";

  return (
    <div className="bg-card border-border max-w-xl space-y-4 rounded-xl border p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-lg font-bold">Anthropic API-Schlüssel</h2>
        <p className="text-muted-foreground mt-1 text-sm">Nötig, damit Assistent & Agenten echten Text erzeugen. Den Schlüssel bekommst du unter console.anthropic.com.</p>
      </div>

      {/* Status */}
      <div className="bg-background border-border rounded-md border p-3 text-sm">
        {status == null ? "Status wird geladen…"
          : status.configured ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">aktiv</span>
              <span className="font-mono">{status.masked}</span>
              <span className="text-muted-foreground text-xs">Quelle: {status.source === "env" ? ".env-Datei" : "Dashboard"}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-[#c0532f]/15 px-2 py-0.5 text-xs font-semibold text-[#c0532f]">nicht hinterlegt</span>
              <span className="text-muted-foreground text-xs">Trage unten deinen Schlüssel ein.</span>
            </span>
          )}
      </div>

      {envLocked && (
        <p className="text-muted-foreground text-xs">Aktuell wird der Schlüssel aus der <code>.env</code> verwendet (hat Vorrang). Entferne ihn dort, wenn du ihn stattdessen hier verwalten willst.</p>
      )}

      {/* Eingabe */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="sk-ant-…" autoComplete="off"
          className="bg-background border-border focus:ring-ring min-w-[14rem] flex-1 rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none" />
        <button type="button" onClick={save} disabled={busy !== null || !key.trim()}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-50">
          {busy === "save" ? "Speichert…" : "Speichern"}
        </button>
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={test} disabled={busy !== null || !status?.configured}
          className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {busy === "test" ? "Teste…" : "Verbindung testen"}
        </button>
        {status?.source === "dashboard" && (
          <button type="button" onClick={remove} disabled={busy !== null}
            className="text-muted-foreground hover:text-destructive rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            Schlüssel entfernen
          </button>
        )}
      </div>

      {note && (
        <p className={`text-sm ${note.ok ? "text-primary" : "text-[#c0532f]"}`}>{note.text}</p>
      )}

      <p className="text-muted-foreground border-border border-t pt-3 text-xs">Der Schlüssel wird nur in deiner eigenen Datenbank gespeichert und nie an den Assistenten-Kontext oder nach außen weitergegeben.</p>
    </div>
  );
}
