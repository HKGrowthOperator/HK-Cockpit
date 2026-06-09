import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authUrl, googleConfigured, publicOrigin } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = publicOrigin(req);
  if (!(await googleConfigured())) {
    return NextResponse.redirect(`${origin}/drive?error=not-configured`);
  }
  const state = crypto.randomUUID();
  (await cookies()).set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(await authUrl(state));
}
