import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/users";
import { createSession, SESSION_COOKIE, isSecureRequest } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort sind nötig." },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort ist falsch." },
      { status: 401 },
    );
  }

  const token = await createSession({ email: user.email });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req), // hinter Funnel via X-Forwarded-Proto erkannt
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
  });
  return res;
}
