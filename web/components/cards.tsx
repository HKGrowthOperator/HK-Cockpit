"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CardModel, Tone } from "@/lib/data/types";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  brand: "bg-gold/15 text-gold-ink",
  ok: "bg-primary/10 text-primary",
  warn: "bg-amber-500/20 text-amber-800",
  bad: "bg-rust/12 text-rust",
  outline: "border border-border text-muted-foreground",
};

const accentBorder: Record<NonNullable<CardModel["accent"]>, string> = {
  brand: "border-l-4 border-l-gold",
  ok: "border-l-4 border-l-primary",
  warn: "border-l-4 border-l-amber-500",
  bad: "border-l-4 border-l-rust",
};

export function Badge({ text, tone = "neutral" }: { text: string; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", toneClasses[tone])}>
      {text}
    </span>
  );
}

function ScoreRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = v >= 75 ? "#2e3a2a" : v >= 45 ? "#a2854f" : "#a9472f";
  return (
    <div
      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${v * 3.6}deg, rgba(46,58,42,0.12) 0deg)` }}
      role="img"
      aria-label={`Relevanz ${v} von 100`}
    >
      <div className="bg-card absolute inset-[4px] rounded-full" />
      <span className="relative text-sm font-bold tabular-nums">{v}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState("Kopieren");
  return (
    <button
      type="button"
      className="border-border bg-card hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setLabel("Kopiert ✓");
          setTimeout(() => setLabel("Kopieren"), 1500);
        } catch {
          setLabel("Strg+C zum Kopieren");
        }
      }}
    >
      {label}
    </button>
  );
}

export function ModuleCard({ model, actions }: { model: CardModel; actions?: React.ReactNode }) {
  return (
    <article
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-5 shadow-sm",
        model.accent && accentBorder[model.accent],
      )}
    >
      {(model.badges?.length || model.score != null) && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {model.badges?.map((b, i) => <Badge key={i} text={b.text} tone={b.tone} />)}
          </div>
          {model.score != null && <ScoreRing value={model.score} />}
        </div>
      )}

      <h3 className="text-[15px] leading-snug font-bold">{model.title}</h3>
      {model.description && <p className="text-muted-foreground text-sm">{model.description}</p>}

      {model.metas?.length ? (
        <div className="flex flex-col gap-2">
          {model.metas.map((m, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{m.label}</span>
              <span className="text-sm">{m.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {model.highlight && (
        <div className="flex flex-col gap-0.5">
          <span className={cn("text-[11px] font-bold tracking-wide uppercase", model.highlight.tone === "bad" ? "text-rust" : model.highlight.tone === "warn" ? "text-amber-800" : "text-gold-ink")}>
            {model.highlight.label}
          </span>
          <span className="text-sm">{model.highlight.value}</span>
        </div>
      )}

      {model.bullets?.map((group, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{group.label}</span>
          <ul className="list-disc pl-5 text-sm">
            {group.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        </div>
      ))}

      {model.pre && (
        <pre className="bg-background border-border max-h-56 overflow-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">{model.pre}</pre>
      )}

      {model.footBadges?.length ? (
        <div className="flex flex-wrap gap-2">
          {model.footBadges.map((b, i) => <Badge key={i} text={b.text} tone={b.tone} />)}
        </div>
      ) : null}

      {model.tags?.length ? (
        <div className="flex flex-wrap gap-2">
          {model.tags.map((t, i) => <Badge key={i} text={`#${t}`} tone="outline" />)}
        </div>
      ) : null}

      {(model.link || model.pre) && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {model.link ? (
            <a className="text-gold-ink text-sm break-all hover:underline" href={model.link.href} target="_blank" rel="noopener noreferrer">{model.link.text}</a>
          ) : <span />}
          {model.pre && <CopyButton text={model.pre} />}
        </div>
      )}

      {actions ? (
        <div className="border-border mt-1 flex justify-end gap-2 border-t pt-3">{actions}</div>
      ) : null}
    </article>
  );
}

function searchableText(m: CardModel): string {
  return [
    m.title, m.description ?? "",
    ...(m.badges?.map((b) => b.text) ?? []),
    ...(m.metas?.flatMap((x) => [x.label, x.value]) ?? []),
    m.highlight ? `${m.highlight.label} ${m.highlight.value}` : "",
    ...(m.bullets?.flatMap((g) => g.items) ?? []),
    ...(m.tags ?? []),
    m.pre ?? "",
  ].join(" ").toLowerCase();
}

function Grid({ items, min = "320px" }: { items: CardModel[]; min?: string }) {
  if (!items.length) {
    return <p className="text-muted-foreground py-12 text-center text-sm">Keine Einträge gefunden.</p>;
  }
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}>
      {items.map((m) => <ModuleCard key={m.id} model={m} />)}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Suchen…"
      aria-label="Suchen"
      className="bg-card border-border focus:ring-ring mb-4 w-full max-w-sm rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
    />
  );
}

export function CardGrid({ items, min, searchable = true }: { items: CardModel[]; min?: string; searchable?: boolean }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((m) => searchableText(m).includes(t)) : items;
  }, [items, q]);
  return (
    <div>
      {searchable && <SearchBox value={q} onChange={setQ} />}
      <Grid items={filtered} min={min} />
    </div>
  );
}

export function TabbedCards({ sections, min }: { sections: { label: string; items: CardModel[] }[]; min?: string }) {
  const [active, setActive] = useState(0);
  const current = sections[active] ?? sections[0];
  return (
    <div>
      <div className="border-border mb-4 flex flex-wrap gap-2 border-b pb-2">
        {sections.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold",
              i === active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <CardGrid items={current.items} min={min} />
    </div>
  );
}
