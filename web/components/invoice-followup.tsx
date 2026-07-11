"use client";

import { useState } from "react";

export type FollowupItem = {
  id: string;
  invoice_id: string;
  company: string;
  customer_name: string;
  stage: string;
  stageLabel: string;
  days: number;
  amount: string; // bereits formatiert
  subject: string;
  body: string;
  needsReview: boolean;
  customer_type: string;
  communication_style: string;
};

const accentForStage = (s: string) =>
  s === "second_dunning" ? "border-rust/50" : s === "first_dunning" || s === "reminder" ? "border-amber-400/50" : "border-border";

export function InvoiceFollowup({ items }: { items: FollowupItem[] }) {
  if (!items.length) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
        Aktuell ist keine Rechnung fällig oder überfällig. 🎉
      </p>
    );
  }
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(420px, 100%), 1fr))" }}>
      {items.map((it) => (
        <FollowupCard key={it.id} item={it} />
      ))}
    </div>
  );
}

function FollowupCard({ item }: { item: FollowupItem }) {
  const [body, setBody] = useState(item.body);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refineWithAI() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: body,
          subject: item.subject,
          stage: item.stage,
          customer_type: item.customer_type,
          communication_style: item.communication_style,
        }),
      });
      const data = (await res.json()) as { body?: string; error?: string };
      if (data.error) setError(data.error);
      else if (data.body) setBody(data.body);
    } catch {
      setError("KI-Veredelung nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(`Betreff: ${item.subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`bg-card rounded-lg border ${accentForStage(item.stage)} p-4`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="bg-secondary rounded px-2 py-0.5 text-xs font-semibold">{item.stageLabel}</span>
        <span className="text-muted-foreground text-xs">
          {item.days > 0 ? `${item.days} Tage überfällig` : "heute fällig"}
        </span>
        {item.needsReview && (
          <span className="text-rust border-rust/40 rounded border px-2 py-0.5 text-xs font-semibold">Review nötig</span>
        )}
        <span className="flex-1" />
        <span className="text-sm font-bold tabular-nums">{item.amount} EUR</span>
      </div>

      <p className="text-sm font-semibold">{item.invoice_id} · {item.company}</p>
      <p className="text-muted-foreground mb-2 text-xs">Betreff: {item.subject}</p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        className="bg-background border-border focus:ring-ring w-full resize-y rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
      />

      {error && <p className="text-rust mt-1 text-xs">{error}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-[#3a4734]"
        >
          {copied ? "Kopiert ✓" : "Kopieren"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={refineWithAI}
          className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? "Verfeinere…" : "Mit KI verfeinern"}
        </button>
      </div>
    </div>
  );
}
