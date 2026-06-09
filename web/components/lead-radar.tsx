"use client";

import { useState } from "react";
import { saveItem } from "@/app/actions";

export type ClientCategory = { id: string; label: string; emoji: string };
export type ClientService = { id: string; label: string };
type Lead = {
  name: string; address: string; phone?: string; email?: string; website?: string;
  instagram?: string; facebook?: string;
  gaps: string[]; services: ClientService[]; score: number; priority: "A" | "B" | "C"; hot: boolean; reason: string;
};
type Result = { area: string; leads: Lead[]; total: number; hotCount: number };

export function LeadRadar({ categories, services }: { categories: ClientCategory[]; services: ClientService[] }) {
  const [cat, setCat] = useState(categories[0]);
  const [place, setPlace] = useState("Gummersbach");
  const [limit, setLimit] = useState(40);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [mail, setMail] = useState<Record<number, { busy: boolean; text: string }>>({});
  const [dossier, setDossier] = useState<Record<number, { busy: boolean; text: string }>>({});
  const [toast, setToast] = useState<string | null>(null);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2500); }
  const shownLeads = (result?.leads ?? []).filter((l) => serviceFilter === "all" || l.services.some((s) => s.id === serviceFilter));

  async function search() {
    if (!place.trim() || busy) return;
    setBusy(true); setResult(null); setSaved(new Set()); setMail({}); setDossier({});
    try {
      const res = await fetch("/api/leads/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat.id, place, limit }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) flash(data.error);
      else setResult(data);
    } catch { flash("Suche fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  async function saveLead(lead: Lead, i: number) {
    const contact = [lead.phone, lead.email].filter(Boolean).join(" · ");
    const notes = [
      lead.address,
      lead.website ? `Web: ${lead.website}` : null,
      lead.gaps.length ? `Lücken: ${lead.gaps.join(", ")}` : null,
      `Passende Leistungen: ${lead.services.map((s) => s.label).join(", ")}`,
      `Gefunden via Lead-Radar (${cat.label})`,
    ].filter(Boolean).join("\n");
    try {
      await saveItem({
        module: "clients", path: "/kundenbedienung",
        data: { name: lead.name, contact, status: "Interessent", notes, tags: [cat.label, "Lead-Radar", ...lead.services.map((s) => s.label), ...(lead.hot ? ["heiß"] : [])] },
      });
      setSaved((s) => new Set(s).add(i));
      flash("Als Interessent gespeichert ✓");
    } catch { flash("Speichern fehlgeschlagen."); }
  }

  async function coldMail(lead: Lead, i: number) {
    setMail((m) => ({ ...m, [i]: { busy: true, text: "" } }));
    const leistungen = lead.services.map((s) => s.label).join(", ");
    const luecken = lead.gaps.length ? `Erkannte Lücken: ${lead.gaps.join(", ")}.` : "Digital schon ordentlich aufgestellt.";
    const task = `Schreibe eine kurze, persönliche Cold-Mail an „${lead.name}" (${cat.label}${result?.area ? ` in ${result.area}` : ""}) im Namen von HK Growth Operator. ${luecken} Ton: klar, ehrlich, kein Hype — „keine Agentur für Aktionismus". Aufhänger: online zeigt sich ihre Qualität noch nicht stark genug. CTA: der HK Wachstums-Check (kurze, unverbindliche Diagnose, kein Verkaufsgespräch), 15-Minuten-Call. Passende Hebel andeuten: ${leistungen}. Konkreter Nutzen statt Buzzwords, inkl. Betreffzeile.`;
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "outreach", task }),
      });
      const data = await res.json().catch(() => ({}));
      setMail((m) => ({ ...m, [i]: { busy: false, text: data.error ? `⚠️ ${data.error}` : (data.output ?? "") } }));
    } catch { setMail((m) => ({ ...m, [i]: { busy: false, text: "Fehlgeschlagen." } })); }
  }

  async function analyze(lead: Lead, i: number) {
    setDossier((d) => ({ ...d, [i]: { busy: true, text: "" } }));
    const known = [
      lead.website ? `Website: ${lead.website}` : "keine Website",
      lead.instagram || lead.facebook ? "Social vorhanden" : "keine Social-Media-Profile",
      lead.email ? `E-Mail: ${lead.email}` : "keine E-Mail",
    ].join(", ");
    const task = `Erstelle ein kurzes Lead-Dossier für „${lead.name}" (${cat.label}${result?.area ? ` in ${result.area}` : ""}) für HK Growth Operator. Bekannt: ${known}. Erkannte Lücken: ${lead.gaps.join(", ") || "keine offensichtlichen"}. Passende Hebel: ${lead.services.map((s) => s.label).join(", ")}. Gib genau diese Punkte aus (kurz, konkret, HK-Ton, keine Floskeln):\n1) Haupt-Pain (1 Satz)\n2) Empfohlenes HK-Angebot (mit Preisanker, falls passend)\n3) Opener-Aufhänger für den Wachstums-Check (1 Satz)\n4) Einschätzung/Confidence (hoch/mittel/niedrig + kurze Begründung). Hinweis: Einschätzung beruht nur auf öffentlichen Kartendaten — Unsicherheiten ehrlich kennzeichnen.`;
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "research", task }),
      });
      const data = await res.json().catch(() => ({}));
      setDossier((d) => ({ ...d, [i]: { busy: false, text: data.error ? `⚠️ ${data.error}` : (data.output ?? "") } }));
    } catch { setDossier((d) => ({ ...d, [i]: { busy: false, text: "Fehlgeschlagen." } })); }
  }

  return (
    <div className="space-y-5">
      {/* Suche */}
      <section className="bg-card border-border space-y-3 rounded-xl border p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 text-sm ${cat.id === c.id ? "border-primary bg-primary/10 text-foreground font-semibold" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Ort oder Region, z. B. München oder Landkreis Rosenheim"
            className="bg-background border-border focus:ring-ring min-w-[16rem] flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none" />
          <select value={limit} onChange={(e) => setLimit(+e.target.value)} className="bg-background border-border rounded-md border px-2 py-2 text-sm">
            {[20, 40, 60, 80].map((n) => <option key={n} value={n}>{n} Leads</option>)}
          </select>
          <button type="button" onClick={search} disabled={busy || !place.trim()}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-50">
            {busy ? "Suche läuft…" : "Leads finden"}
          </button>
        </div>
        <p className="text-muted-foreground text-xs">Echte Betriebsdaten aus OpenStreetMap. Jeder Lead wird gegen euer Leistungsspektrum geprüft — je mehr Lücken, desto größer die Chance.</p>
      </section>

      {/* Ergebnis */}
      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Gefunden" value={result.leads.length} />
            <Tile label="🔥 Heiße Leads (≥2 Lücken)" value={result.hotCount} accent />
            <Tile label="Region" text={result.area} />
          </div>

          {/* Filter nach Leistung */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Leistung:</span>
            {[{ id: "all", label: "Alle" }, ...services].map((s) => (
              <button key={s.id} type="button" onClick={() => setServiceFilter(s.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${serviceFilter === s.id ? "border-primary bg-primary/10 text-foreground font-semibold" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                {s.label}
              </button>
            ))}
            <span className="text-muted-foreground ml-auto text-xs">{shownLeads.length} angezeigt</span>
          </div>

          {shownLeads.length === 0 && <p className="text-muted-foreground text-sm">Keine Treffer — anderen Ort, andere Branche oder Leistung „Alle" wählen.</p>}

          <div className="space-y-3">
            {shownLeads.map((lead, i) => (
              <div key={i} className={`bg-card rounded-xl border p-4 shadow-sm ${lead.hot ? "border-l-4 border-l-[#c0532f]" : "border-border"}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white ${lead.priority === "A" ? "bg-[#c0532f]" : lead.priority === "B" ? "bg-[#b5852f]" : "bg-[#5b6b7d]"}`} title={`Priorität ${lead.priority}`}>{lead.priority}</span>
                      <strong className="truncate">{lead.name}</strong>
                      {lead.hot
                        ? <span className="rounded-full bg-[#c0532f]/15 px-2 py-0.5 text-[11px] font-semibold text-[#c0532f]">🔥 heiß</span>
                        : <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">warm</span>}
                    </div>
                    {lead.address && <div className="text-muted-foreground mt-0.5 text-sm">{lead.address}</div>}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {lead.phone && <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>}
                      {lead.email && <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>}
                      {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Website ↗</a>}
                      {lead.instagram && <span className="text-muted-foreground">Instagram ✓</span>}
                      {lead.facebook && <span className="text-muted-foreground">Facebook ✓</span>}
                    </div>
                    {lead.gaps.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {lead.gaps.map((g) => (
                          <span key={g} className="rounded-full bg-[#c0532f]/10 px-2 py-0.5 text-[11px] font-medium text-[#c0532f]">{g}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-muted-foreground text-[11px]">passt:</span>
                      {lead.services.map((s) => (
                        <span key={s.id} className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">{s.label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button type="button" onClick={() => analyze(lead, i)} disabled={dossier[i]?.busy}
                      className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                      {dossier[i]?.busy ? "analysiert…" : "🔍 Analysieren"}
                    </button>
                    <button type="button" onClick={() => saveLead(lead, i)} disabled={saved.has(i)}
                      className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                      {saved.has(i) ? "✓ Interessent" : "Als Interessent"}
                    </button>
                    <button type="button" onClick={() => coldMail(lead, i)} disabled={mail[i]?.busy}
                      className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-[#3a4734] disabled:opacity-50">
                      {mail[i]?.busy ? "schreibt…" : "✉️ Cold-Mail"}
                    </button>
                  </div>
                </div>
                {dossier[i]?.text && (
                  <div className="mt-3">
                    <div className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">🔍 Lead-Dossier (KI-Einschätzung)</div>
                    <div className="bg-background border-border max-h-80 overflow-auto rounded-md border p-3 text-sm whitespace-pre-wrap">{dossier[i].text}</div>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(dossier[i].text); flash("Kopiert ✓"); }}
                      className="border-border hover:bg-secondary mt-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold">Kopieren</button>
                  </div>
                )}
                {mail[i]?.text && (
                  <div className="mt-3">
                    <div className="bg-background border-border max-h-72 overflow-auto rounded-md border p-3 text-sm whitespace-pre-wrap">{mail[i].text}</div>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(mail[i].text); flash("Kopiert ✓"); }}
                      className="border-border hover:bg-secondary mt-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold">Kopieren</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">Betriebsdaten © OpenStreetMap-Mitwirkende (ODbL).</p>
        </>
      )}

      {toast && <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">{toast}</div>}
    </div>
  );
}

function Tile({ label, value, text, accent }: { label: string; value?: number; text?: string; accent?: boolean }) {
  return (
    <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
      <div className={`font-serif font-bold ${text ? "truncate text-base" : "text-2xl"} ${accent ? "text-[#c0532f]" : ""}`}>{text ?? value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
