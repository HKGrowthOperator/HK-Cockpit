"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveItem } from "@/app/actions";

export type Proposal = {
  key: string;
  aktion: "anlegen" | "bearbeiten";
  modul: string;
  id?: string;
  titel: string;
  felder: Record<string, unknown>;
};

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

export function ProposalCards({ proposals, flash }: { proposals: Proposal[]; flash: (m: string) => void }) {
  const router = useRouter();
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());

  async function apply(p: Proposal) {
    try {
      await saveItem({
        module: p.modul,
        path: PATH[p.modul] ?? "/",
        id: p.aktion === "bearbeiten" ? p.id : undefined,
        data: p.felder,
      });
      setApplied((s) => new Set(s).add(p.key));
      flash(p.aktion === "bearbeiten" ? "Änderung übernommen ✓" : "Angelegt ✓");
      router.refresh();
    } catch {
      flash("Speichern fehlgeschlagen");
    }
  }

  const visible = proposals.filter((p) => !discarded.has(p.key));
  if (!visible.length) return null;

  return (
    <div className="space-y-3">
      {visible.map((p) => {
        const isApplied = applied.has(p.key);
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
                  <span className="font-medium">{k}:</span> {Array.isArray(v) ? v.join(" · ") : String(v)}
                </li>
              ))}
            </ul>
            {isApplied ? (
              <span className="text-primary text-xs font-semibold">✓ Übernommen</span>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => apply(p)}
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
  );
}
