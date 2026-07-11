import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getApiKey, resolveModel } from "@/lib/assistant";

// Optionale KI-Veredelung eines Erinnerungs-Entwurfs. Funktioniert nur, wenn ein
// Anthropic-Schlüssel hinterlegt ist (.env oder Einstellungen); sonst kommt der
// Entwurf unverändert zurück. Geschützt wie jede Nicht-Login-Route.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  draft?: string;
  subject?: string;
  stage?: string;
  customer_type?: string;
  communication_style?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const draft = (body.draft ?? "").trim();
  if (!draft) return NextResponse.json({ error: "Kein Entwurf erhalten." }, { status: 400 });

  const apiKey = await getApiKey();
  if (!apiKey) {
    return NextResponse.json({
      body: draft,
      error: "Kein API-Schlüssel hinterlegt — Entwurf unverändert. Schlüssel unter Einstellungen ergänzen.",
    });
  }

  const system =
    "Du bist ein professioneller Buchhaltungs-Assistent und verfeinerst deutsche Zahlungserinnerungen/Mahnungen. " +
    "Behalte Mahnstufe, Beträge, Rechnungsnummern und Fristen exakt bei. Verändere keine Zahlen. " +
    "Passe nur Tonalität und Formulierung an Kundentyp und Kommunikationsstil an. " +
    `Mahnstufe: ${body.stage ?? "?"}. Kundentyp: ${body.customer_type ?? "?"}. Stil: ${body.communication_style ?? "neutral"}. ` +
    "Antworte ausschließlich mit dem reinen Nachrichtentext (kein Betreff, keine Erklärung).";

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: resolveModel(),
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: draft }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return NextResponse.json({ body: text || draft });
  } catch (err) {
    const error =
      err instanceof Anthropic.AuthenticationError
        ? "API-Schlüssel abgelehnt."
        : err instanceof Anthropic.APIError
          ? `API-Fehler (${err.status}).`
          : "Unerwarteter Fehler bei der KI-Veredelung.";
    return NextResponse.json({ body: draft, error });
  }
}
