// POST /api/automations/run — startet eine Automation aus dem Cockpit.
// Ruft den Webhook des zugehörigen n8n-Workflows und protokolliert den Lauf
// in agent_runs, damit er sofort im Dashboard auftaucht.
//
// Geschützt durch die normale Login-Sitzung (middleware.ts) — anders als der
// Rückkanal /log, den externe Automationen ohne Login ansprechen.
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { starteAutomation, istStartbar, n8nKonfiguriert } from "@/lib/automations-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { id?: string; titel?: string };

export async function POST(req: Request) {
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Body;

  if (!istStartbar(b.id)) {
    return NextResponse.json(
      { error: "Diese Automation hat keine hinterlegte Kennung und kann nicht gestartet werden." },
      { status: 400 },
    );
  }
  if (!n8nKonfiguriert()) {
    return NextResponse.json(
      {
        error: "n8n ist nicht verbunden.",
        hinweis: "N8N_BASE_URL in den Umgebungsvariablen des Cockpits eintragen, dann neu deployen.",
      },
      { status: 503 },
    );
  }

  const titel = b.titel?.trim() || b.id;

  // Lauf als "läuft" anlegen — so ist er auch dann sichtbar, wenn n8n
  // langsam ist oder gar nicht antwortet.
  let laufId: string | null = null;
  try {
    const rows = await q<{ id: string }>(
      `INSERT INTO agent_runs (automation, trigger, status, started_at)
       VALUES ($1, 'manual', 'running', now()) RETURNING id`,
      [titel],
    );
    laufId = rows[0]?.id ?? null;
  } catch {
    // Protokollierung darf den Start nicht verhindern.
  }

  const ergebnis = await starteAutomation(b.id, { automation: titel, lauf_id: laufId });

  // Ergebnis nachtragen. Meldet der Workflow selbst über den Rückkanal, wird
  // dieser Eintrag später von ihm überschrieben — das ist gewollt.
  if (laufId) {
    try {
      await q(
        `UPDATE agent_runs
            SET status = $2, finished_at = now(), summary = $3, error = $4
          WHERE id = $1 AND status = 'running'`,
        [
          laufId,
          ergebnis.ok ? "success" : "error",
          ergebnis.ok ? "Aus dem Cockpit gestartet." : null,
          ergebnis.ok ? null : `${ergebnis.fehler}${ergebnis.hinweis ? " " + ergebnis.hinweis : ""}`,
        ],
      );
    } catch {
      /* egal */
    }
  }

  if (!ergebnis.ok) {
    return NextResponse.json(
      { error: ergebnis.fehler, hinweis: ergebnis.hinweis, lauf_id: laufId },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, lauf_id: laufId, antwort: ergebnis.antwort });
}

/** Zeigt an, ob Automationen überhaupt gestartet werden können. */
export async function GET() {
  return NextResponse.json({ bereit: n8nKonfiguriert() });
}
