// GET /api/zentrale/health — Lebenszeichen des Cockpits (für Coolify und die
// eigene Statusanzeige). Verrät nichts außer „läuft" und ob die Datenbank antwortet.
import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await q("SELECT 1");
    return NextResponse.json({ ok: true, datenbank: "ok" });
  } catch {
    return NextResponse.json({ ok: false, datenbank: "nicht erreichbar" }, { status: 503 });
  }
}
