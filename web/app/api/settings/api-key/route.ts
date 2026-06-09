import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { API_KEY_SECRET, getApiKeyStatus, getClientAsync, resolveModel } from "@/lib/assistant";
import { setSecret, delSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getApiKeyStatus());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; key?: string };

  if (body.action === "save") {
    const key = body.key?.trim();
    if (!key || !key.startsWith("sk-")) {
      return NextResponse.json({ error: "Das sieht nicht wie ein gültiger Schlüssel aus (beginnt mit sk-)." }, { status: 200 });
    }
    await setSecret(API_KEY_SECRET, key);
    return NextResponse.json({ ok: true, status: await getApiKeyStatus() });
  }

  if (body.action === "delete") {
    await delSecret(API_KEY_SECRET);
    return NextResponse.json({ ok: true, status: await getApiKeyStatus() });
  }

  if (body.action === "test") {
    const client = await getClientAsync();
    if (!client) return NextResponse.json({ ok: false, error: "Kein Schlüssel hinterlegt." }, { status: 200 });
    try {
      await client.messages.create({
        model: resolveModel("claude-haiku-4-5"),
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      const msg =
        err instanceof Anthropic.AuthenticationError
          ? "Schlüssel wurde abgelehnt — bitte prüfen."
          : err instanceof Anthropic.RateLimitError
            ? "Schlüssel gültig, aber Rate-Limit/Guthaben erreicht."
            : err instanceof Anthropic.APIError
              ? `API-Fehler (${err.status}): ${err.message}`
              : (err as Error).message || "Test fehlgeschlagen.";
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
