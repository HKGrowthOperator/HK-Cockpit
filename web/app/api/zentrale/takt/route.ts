// POST /api/zentrale/takt — sendet fällige, freigegebene Mails (verzögerte
// Regeln, Tageslimit, Wiederholung). Aufruf alle paar Minuten aus n8n oder
// einem Coolify-Zeitplan:
//   curl -X POST -H "x-takt-secret: $ZENTRALE_TAKT_SECRET" https://<cockpit>/api/zentrale/takt
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { versendeFaellige } from "@/lib/zentrale/mail/ausgang";

export const dynamic = "force-dynamic";

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const secret = process.env.ZENTRALE_TAKT_SECRET || process.env.AUTOMATION_INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "ZENTRALE_TAKT_SECRET fehlt." }, { status: 503 });
  if (!gleich(req.headers.get("x-takt-secret") ?? "", secret)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }
  const ergebnis = await versendeFaellige(50);
  return NextResponse.json({ ok: true, ...ergebnis });
}
