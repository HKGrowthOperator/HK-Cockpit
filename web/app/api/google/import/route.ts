import { NextResponse } from "next/server";
import { fetchText } from "@/lib/google";
import { proposeFromText } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { fileId?: string; mimeType?: string; model?: string };
  if (!body.fileId || !body.mimeType) {
    return NextResponse.json({ error: "Datei fehlt." }, { status: 400 });
  }
  try {
    const text = await fetchText(body.fileId, body.mimeType);
    if (text == null) {
      return NextResponse.json({
        error: "Dieser Dateityp kann (noch) nicht als Text gelesen werden. Unterstützt: Google Docs/Sheets/Slides und Text-Dateien.",
      });
    }
    const { reply, proposals } = await proposeFromText(text, body.model);
    return NextResponse.json({ reply, proposals, excerpt: text.slice(0, 600) });
  } catch (err) {
    const m = (err as Error).message;
    return NextResponse.json({ error: m === "not-connected" ? "Nicht mit Google verbunden." : m });
  }
}
