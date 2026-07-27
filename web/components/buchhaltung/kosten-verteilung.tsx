import { formatCent } from "@/lib/accounting/buchen";
import type { Kostenblock } from "@/lib/accounting/auswertung";

const FARBEN = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-3)", "var(--muted-foreground)",
];

/** Kostenblöcke als gestapelter Balken plus Legende — ruhiger als ein
 *  Tortendiagramm und auf schmalen Bildschirmen besser lesbar. */
export function KostenVerteilung({ blocks }: { blocks: Kostenblock[] }) {
  if (!blocks.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Noch keine Ausgaben erfasst.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {blocks.map((b, i) => (
          <div
            key={b.gruppe}
            style={{ width: `${b.anteil}%`, background: FARBEN[i % FARBEN.length] }}
            title={`${b.gruppe}: ${b.anteil} %`}
          />
        ))}
      </div>

      <div className="grid gap-2">
        {blocks.map((b, i) => (
          <div key={b.gruppe} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: FARBEN[i % FARBEN.length] }} />
              <span className="truncate">{b.gruppe}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">{b.anteil} %</span>
              <span className="font-medium tabular-nums">{formatCent(b.betrag_cent)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
