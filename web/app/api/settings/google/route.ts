import { NextResponse } from "next/server";
import { getGoogleConfigStatus, setGoogleConfig, clearGoogleConfig, disconnect } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getGoogleConfigStatus());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; clientId?: string; clientSecret?: string; redirectUri?: string };

  if (body.action === "save") {
    const clientId = body.clientId?.trim() ?? "";
    const clientSecret = body.clientSecret?.trim() ?? "";
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Client-ID und Client-Secret sind beide nötig." }, { status: 200 });
    }
    await setGoogleConfig({ clientId, clientSecret, redirectUri: body.redirectUri?.trim() ?? "" });
    return NextResponse.json({ ok: true, status: await getGoogleConfigStatus() });
  }

  if (body.action === "delete") {
    await clearGoogleConfig();
    await disconnect();
    return NextResponse.json({ ok: true, status: await getGoogleConfigStatus() });
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
