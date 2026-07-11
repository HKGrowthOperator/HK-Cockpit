// POST /api/automations/log — Rückkanal für Automationen (n8n, Make, Zapier, Cron).
// Jede Automation meldet hier Start/Ende ihres Laufs; füllt agent_runs = die
// "Single Source of Truth", die das Cockpit-Dashboard ("live aus n8n") liest.
//
// Öffentlich (in middleware.ts von der Auth ausgenommen), da externe Automationen
// keine Login-Session haben. Absicherung optional über AUTOMATION_INGEST_SECRET:
//   - lokal: unset -> offen (nur über localhost/Docker erreichbar)
//   - Server: setzen -> Header "x-automation-secret" muss passen
//
// Aufruf – neuen Lauf starten:
//   POST { automation, trigger?, status?, summary? }            -> { id }
// Aufruf – Lauf abschließen:
//   POST { id, status:"success"|"error", summary?, error?, cost_eur? } -> { id }
import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["running", "success", "error"]);
const VALID_TRIGGER = new Set(["manual", "webhook", "schedule", "event"]);

type Body = {
  id?: string;
  automation?: string;
  trigger?: string;
  status?: string;
  summary?: string;
  error?: string;
  cost_eur?: number;
};

export async function POST(req: Request) {
  const secret = process.env.AUTOMATION_INGEST_SECRET;
  if (secret && req.headers.get("x-automation-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const b = ((await req.json().catch(() => ({}))) ?? {}) as Body;
  const status = b.status && VALID_STATUS.has(b.status) ? b.status : "success";

  try {
    // Abschluss eines bestehenden Laufs.
    if (b.id) {
      const rows = await q<{ id: string }>(
        `UPDATE agent_runs
            SET status      = $2,
                finished_at = CASE WHEN $2 = 'running' THEN finished_at ELSE now() END,
                summary     = COALESCE($3, summary),
                error       = $4,
                cost_eur    = COALESCE($5, cost_eur)
          WHERE id = $1
        RETURNING id`,
        [b.id, status, b.summary ?? null, b.error ?? null, b.cost_eur ?? null],
      );
      if (!rows[0]) return NextResponse.json({ error: "Lauf nicht gefunden." }, { status: 404 });
      return NextResponse.json({ id: rows[0].id, status });
    }

    // Neuer Lauf.
    if (!b.automation?.trim()) {
      return NextResponse.json({ error: "Feld 'automation' ist nötig." }, { status: 400 });
    }
    const trigger = b.trigger && VALID_TRIGGER.has(b.trigger) ? b.trigger : "manual";
    const rows = await q<{ id: string }>(
      `INSERT INTO agent_runs (automation, trigger, status, started_at, finished_at, summary, error, cost_eur)
       VALUES ($1, $2, $3, now(), CASE WHEN $3 = 'running' THEN NULL ELSE now() END, $4, $5, COALESCE($6, 0))
       RETURNING id`,
      [b.automation.trim(), trigger, status, b.summary ?? null, b.error ?? null, b.cost_eur ?? null],
    );
    return NextResponse.json({ id: rows[0].id, status });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "DB-Fehler." },
      { status: 500 },
    );
  }
}
