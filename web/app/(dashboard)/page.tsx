import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { RunsChart } from "@/components/runs-chart";
import { RecentRunsTable } from "@/components/recent-runs-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { getKpis, getTrend, getRecentRuns, type Kpis, type TrendPoint, type Run } from "@/lib/queries";
import { listItems } from "@/lib/store";

// Immer frisch rendern (Live-Übersicht).
export const dynamic = "force-dynamic";

const OVERVIEW: { key: string; label: string; href: string; hint: string }[] = [
  { key: "clients", label: "Kunden", href: "/kundenbedienung", hint: "verwalten & bedienen" },
  { key: "sops", label: "SOPs", href: "/sops", hint: "Abläufe & Playbooks" },
  { key: "templates", label: "Vorlagen", href: "/kundenbedienung", hint: "fertige Antworten" },
  { key: "concepts", label: "Konzepte", href: "/konzepte", hint: "Angebote & Kampagnen" },
  { key: "automations", label: "Automationen", href: "/automation", hint: "Idee → live" },
  { key: "websites", label: "Webseiten", href: "/webseiten", hint: "Projekte & Status" },
  { key: "reports", label: "Berichte", href: "/berichte", hint: "Wochenreports" },
  { key: "ai_updates", label: "AI-Updates", href: "/ai-intelligence", hint: "Markt im Blick" },
];

export default async function Page() {
  // Übersicht: Anzahl je Modul (legt Tabellen bei Bedarf automatisch an).
  const counts = await Promise.all(OVERVIEW.map((o) => listItems(o.key).then((r) => r.length)));

  // Live-Daten aus n8n; robust, falls noch keine Tabelle/Läufe vorhanden sind.
  let kpis: Kpis | null = null;
  let trend: TrendPoint[] = [];
  let runs: Run[] = [];
  let liveError = false;
  try {
    [kpis, trend, runs] = await Promise.all([getKpis(), getTrend(), getRecentRuns()]);
  } catch {
    liveError = true;
  }
  const successRate = kpis?.success_rate_pct != null ? `${kpis.success_rate_pct}%` : "–";

  return (
    <>
      <AutoRefresh seconds={30} />
      <p className="text-muted-foreground mb-6 text-sm">
        Deine Schaltzentrale — alle Bereiche auf einen Blick. Klick eine Kachel, um direkt loszulegen.
      </p>

      {/* OS auf einen Blick */}
      <section className="mb-8">
        <h2 className="mb-3 font-serif text-lg font-bold">Dein OS auf einen Blick</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {OVERVIEW.map((o, i) => (
            <Link
              key={o.key + o.href}
              href={o.href}
              className="bg-card border-border hover:border-gold flex flex-col gap-1 rounded-xl border p-5 shadow-sm transition-colors"
            >
              <span className="text-3xl font-bold tabular-nums">{counts[i]}</span>
              <span className="font-semibold">{o.label}</span>
              <span className="text-muted-foreground text-xs">{o.hint} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Automationen live */}
      <section>
        <h2 className="mb-3 font-serif text-lg font-bold">Automationen (live aus n8n)</h2>
        {liveError ? (
          <Card>
            <CardContent>
              <p className="text-muted-foreground py-6 text-sm">
                Noch keine Verbindung zu Lauf-Daten. Sobald deine n8n-Automationen Läufe protokollieren,
                erscheinen hier Kennzahlen, Trend und die letzten Läufe.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Läufe heute" value={String(kpis?.runs_today ?? 0)} />
              <StatCard
                label="Erfolgsquote (7 Tage)"
                value={successRate}
                tone={
                  kpis?.success_rate_pct == null
                    ? "default"
                    : kpis.success_rate_pct >= 90
                      ? "good"
                      : kpis.success_rate_pct >= 70
                        ? "warn"
                        : "bad"
                }
              />
              <StatCard label="Kosten diesen Monat" value={`${Number(kpis?.cost_eur_month ?? 0).toFixed(2)} €`} />
              <StatCard
                label="Offene Fehler (7 Tage)"
                value={String(kpis?.open_errors ?? 0)}
                tone={Number(kpis?.open_errors) > 0 ? "bad" : "good"}
              />
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Läufe &amp; Fehler pro Tag (30 Tage)</CardTitle>
              </CardHeader>
              <CardContent>
                {trend.length ? (
                  <RunsChart data={trend} />
                ) : (
                  <p className="text-muted-foreground py-12 text-center text-sm">Noch keine Läufe erfasst.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Letzte Läufe</CardTitle>
              </CardHeader>
              <CardContent>
                {runs.length ? (
                  <RecentRunsTable runs={runs} />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">Noch keine Läufe erfasst.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </>
  );
}
