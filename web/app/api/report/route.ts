import { NextResponse } from "next/server";
import { generateReport } from "@/lib/report";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { clientName?: string; notes?: string; model?: string };
  const clientName = (body.clientName ?? "").trim();
  if (!clientName) {
    return NextResponse.json({ error: "Bitte einen Kunden wählen." }, { status: 400 });
  }
  const { report, error } = await generateReport({
    clientName,
    notes: body.notes ?? "",
    model: body.model,
  });
  if (error === "no-key") {
    return NextResponse.json({
      error:
        "Es ist noch kein Anthropic-API-Schlüssel hinterlegt. Trage ANTHROPIC_API_KEY in die .env ein und starte den Web-Container neu (docker compose -f docker-compose.local.yml up -d).",
    });
  }
  return NextResponse.json(error ? { error } : { report });
}
