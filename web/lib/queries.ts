import { q } from "./db";

export type Kpis = {
  runs_today: number;
  success_rate_pct: number | null;
  cost_eur_month: number;
  open_errors: number;
};

export type TrendPoint = {
  day: string; // ISO-Datum
  runs: number;
  errors: number;
  cost_eur: number;
};

export type Run = {
  automation: string;
  trigger: string;
  status: "running" | "success" | "error";
  started_at: string;
  duration_sec: number | null;
  cost_eur: number;
  summary: string | null;
  error: string | null;
};

export async function getKpis(): Promise<Kpis> {
  const rows = await q<Kpis>(`
    SELECT
      (SELECT runs_today        FROM v_runs_today)       AS runs_today,
      (SELECT success_rate_pct  FROM v_success_rate_7d)  AS success_rate_pct,
      (SELECT cost_eur_month    FROM v_cost_month)        AS cost_eur_month,
      (SELECT open_errors       FROM v_open_errors)       AS open_errors
  `);
  return rows[0];
}

export async function getTrend(): Promise<TrendPoint[]> {
  return q<TrendPoint>(`
    SELECT to_char(day, 'YYYY-MM-DD') AS day, runs, errors, cost_eur
    FROM v_daily_trend ORDER BY day
  `);
}

export async function getRecentRuns(): Promise<Run[]> {
  return q<Run>(`SELECT * FROM v_recent_runs`);
}
