import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { agentId?: string; task?: string; model?: string; priorWork?: string };
  if (!body.agentId || !body.task?.trim()) {
    return NextResponse.json({ error: "Agent und Auftrag sind nötig." }, { status: 400 });
  }
  try {
    const result = await runAgent(body.agentId, body.task.trim(), body.model, body.priorWork);
    return NextResponse.json(result);
  } catch (err) {
    const msg =
      err instanceof Anthropic.AuthenticationError
        ? "Der API-Schlüssel wurde abgelehnt."
        : err instanceof Anthropic.RateLimitError
          ? "Rate-Limit oder Guthaben erreicht — später erneut versuchen."
          : err instanceof Anthropic.APIError
            ? `API-Fehler (${err.status}): ${err.message}`
            : (err as Error).message || "Unerwarteter Fehler.";
    return NextResponse.json({ error: msg }, { status: 200 });
  }
}
