import { NextResponse } from "next/server";
import { searchLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { category?: string; place?: string; limit?: number };
  if (!body.category || !body.place?.trim()) {
    return NextResponse.json({ error: "Branche und Ort sind nötig." }, { status: 400 });
  }
  try {
    const result = await searchLeads(body.category, body.place.trim(), Math.min(body.limit ?? 40, 80));
    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message || "";
    const friendly =
      /HTTP 429/i.test(msg)
        ? "OpenStreetMap-Server gerade überlastet (Rate-Limit) — in ein, zwei Minuten erneut versuchen."
        : /fetch failed|ENOTFOUND|EAI_AGAIN|abort|network|HTTP 5|HTTP 4/i.test(msg)
          ? "Kein Zugriff auf OpenStreetMap — der Container hat keinen Internet-Ausgang. Prüfe die Netzwerk-Freigabe (bei lokalem Docker normal vorhanden) und versuch es erneut."
          : msg || "Suche fehlgeschlagen.";
    return NextResponse.json({ error: friendly }, { status: 200 });
  }
}
