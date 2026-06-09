import type { Run } from "@/lib/queries";
import { cn } from "@/lib/utils";

const statusStyle: Record<Run["status"], string> = {
  success: "bg-primary/10 text-primary",
  error: "bg-rust/12 text-rust",
  running: "bg-amber-500/20 text-amber-800",
};

const statusLabel: Record<Run["status"], string> = {
  success: "Erfolg",
  error: "Fehler",
  running: "läuft",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentRunsTable({ runs }: { runs: Run[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-border border-b text-left">
          <tr>
            <th className="py-2 pr-4 font-medium">Automation</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Start</th>
            <th className="py-2 pr-4 font-medium text-right">Dauer</th>
            <th className="py-2 pr-4 font-medium text-right">Kosten</th>
            <th className="py-2 font-medium">Ergebnis</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} className="border-border/50 border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{r.automation}</td>
              <td className="py-2 pr-4">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusStyle[r.status],
                  )}
                >
                  {statusLabel[r.status]}
                </span>
              </td>
              <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                {fmtTime(r.started_at)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {r.duration_sec != null ? `${r.duration_sec}s` : "–"}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {Number(r.cost_eur).toFixed(2)} €
              </td>
              <td className="text-muted-foreground py-2">
                {r.error ?? r.summary ?? "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
