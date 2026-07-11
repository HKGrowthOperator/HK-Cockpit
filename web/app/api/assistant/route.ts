import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { runAssistant, type ChatMessage } from "@/lib/assistant";

// Protected by the auth proxy/middleware like every non-login route.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { messages?: ChatMessage[]; model?: string };
  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim(),
  );
  if (!messages.length) {
    return NextResponse.json({ error: "Keine Nachricht erhalten." }, { status: 400 });
  }

  try {
    const { reply, proposals } = await runAssistant(messages, body.model);
    const fallback = proposals.length ? "Ich habe folgende Vorschläge vorbereitet — bitte bestätigen:" : "(keine Antwort)";
    return NextResponse.json({ reply: reply || fallback, proposals });
  } catch (err) {
    const msg =
      err instanceof Anthropic.AuthenticationError
        ? "Der API-Schlüssel wurde abgelehnt. Bitte ANTHROPIC_API_KEY prüfen."
        : err instanceof Anthropic.RateLimitError
          ? "Rate-Limit oder Guthaben erreicht — bitte später erneut versuchen."
          : err instanceof Anthropic.APIError
            ? `API-Fehler (${err.status}): ${err.message}`
            : "Unerwarteter Fehler beim Aufruf des Assistenten.";
    return NextResponse.json({ error: msg, proposals: [] }, { status: 200 });
  }
}
