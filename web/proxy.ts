import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

// Schützt die gesamte App: ohne gültige Sitzung geht es zurück zum Login.
export async function proxy(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Hinter einem TLS-terminierenden Proxy (Tailscale Funnel) ist die interne
    // Verbindung HTTP. Ziel-URL aus den Forwarded-Headern bauen, damit nicht auf
    // ein internes http:// umgeleitet wird (sonst geht das Secure-Cookie verloren).
    const xfProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    const xfHost = req.headers.get("x-forwarded-host");
    if (xfHost) url.host = xfHost;
    if (xfProto) url.protocol = `${xfProto}:`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Alles abdecken AUSSER: Login-Seite, Login-API, Automations-Rückkanal,
  // Ereignis-Eingang und Takt der Zentrale (eigene Signatur), Health,
  // Next-interne Pfade, Favicon.
  matcher: ["/((?!login|api/login|api/automations/log|api/ereignisse|api/zentrale/takt|api/zentrale/health|_next/static|_next/image|favicon.ico).*)"],
};
