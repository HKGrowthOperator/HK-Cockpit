// POST /api/ereignisse/<app> — Eingang für Ereignisse aus den HK-Apps.
//
// Öffentlich erreichbar (in proxy.ts von der Anmeldung ausgenommen), geschützt
// durch die HMAC-Signatur, die die Apps ohnehin senden:
//   Webstudio (WEBSEITE):  X-HK-Signature: sha256=<hex>
//   Coldmail:              X-Coldmail-Signature: sha256=<hex>
// Das Geheimnis erzeugt die Geschäftsführung in der App unter Apps → <App>.
import { NextResponse } from "next/server";
import { ladeEreignis, nimmEreignisAn } from "@/lib/zentrale/ereignisse";
import { regelnAnwenden, versendeFaellige } from "@/lib/zentrale/mail/ausgang";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ app: string }> }) {
  const { app } = await ctx.params;
  if (Number(req.headers.get("content-length") ?? 0) > 256 * 1024) {
    return NextResponse.json({ error: "Zu groß." }, { status: 413 });
  }
  const roh = await req.text();
  const ergebnis = await nimmEreignisAn(app, roh, req.headers);
  if (!ergebnis.ok) return NextResponse.json({ error: ergebnis.meldung }, { status: ergebnis.status });

  let mails = 0;
  if (ergebnis.neu && ergebnis.id) {
    try {
      const e = await ladeEreignis(ergebnis.id);
      if (e) mails = await regelnAnwenden(e);
      if (mails) await versendeFaellige(10);
    } catch (err) {
      // Das Ereignis ist gespeichert; eine Regel, die scheitert, darf den
      // Absender nicht zu Wiederholungen bringen.
      console.error("[ereignisse] Mail-Regeln:", (err as Error).message);
    }
  }
  return NextResponse.json({ ok: true, neu: ergebnis.neu, mails });
}
