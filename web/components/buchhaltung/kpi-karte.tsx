import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/accounting/auswertung";

type Ton = "neutral" | "gut" | "warn" | "schlecht" | "gold";

const AKZENT: Record<Ton, { ring: string; punkt: string; wert: string }> = {
  neutral: { ring: "bg-muted", punkt: "bg-muted-foreground/40", wert: "text-foreground" },
  gut: { ring: "bg-primary/10", punkt: "bg-primary", wert: "text-foreground" },
  gold: { ring: "bg-gold/15", punkt: "bg-gold", wert: "text-foreground" },
  warn: { ring: "bg-gold/15", punkt: "bg-gold", wert: "text-gold-ink" },
  schlecht: { ring: "bg-rust/10", punkt: "bg-rust", wert: "text-rust" },
};

/** Kennzahlkarte mit Wert, Trendabzeichen und optionaler Fußzeile. */
export function KpiKarte({
  label,
  wert,
  hinweis,
  trend,
  ton = "neutral",
  /** true = Rückgang ist positiv (z. B. bei Kosten). */
  wenigerIstBesser = false,
  fuss,
}: {
  label: string;
  wert: string;
  hinweis?: string;
  trend?: Trend;
  ton?: Ton;
  wenigerIstBesser?: boolean;
  fuss?: React.ReactNode;
}) {
  const a = AKZENT[ton];
  const zeigeTrend = trend && trend.prozent !== null;
  const positiv = trend ? (wenigerIstBesser ? !trend.gestiegen : trend.gestiegen) : true;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* dezenter Farbschleier oben rechts als Akzent */}
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", a.ring)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", a.punkt)} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {zeigeTrend && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              positiv ? "bg-primary/10 text-primary" : "bg-rust/10 text-rust",
            )}
            title={`Vormonat: ${(trend!.vorher_cent / 100).toLocaleString("de-DE", {
              style: "currency", currency: "EUR",
            })}`}
          >
            {trend!.gestiegen ? "▲" : "▼"} {Math.abs(trend!.prozent!)} %
          </span>
        )}
      </div>

      <div className={cn("relative mt-3 text-2xl font-semibold tracking-tight tabular-nums", a.wert)}>
        {wert}
      </div>
      {hinweis && <div className="relative mt-1 text-xs text-muted-foreground">{hinweis}</div>}
      {fuss && <div className="relative mt-3 border-t pt-3 text-xs text-muted-foreground">{fuss}</div>}
    </div>
  );
}
