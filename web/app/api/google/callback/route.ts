import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, publicOrigin } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("g_oauth_state")?.value;

  if (!code || !state || state !== saved) {
    return NextResponse.redirect(`${origin}/drive?error=state`);
  }
  try {
    await exchangeCode(code);
  } catch {
    return NextResponse.redirect(`${origin}/drive?error=exchange`);
  }
  jar.delete("g_oauth_state");
  return NextResponse.redirect(`${origin}/drive?connected=1`);
}
