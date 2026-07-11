import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Geheimer Schlüssel zum Signieren der Login-Sitzung. In Produktion via AUTH_SECRET setzen.
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-insecure-secret-bitte-aendern",
);

export const SESSION_COOKIE = "mw_session";

// Erkennt, ob die Anfrage (auch hinter einem TLS-terminierenden Reverse-Proxy
// wie Tailscale Funnel) effektiv über HTTPS kam. Steuert das Secure-Flag des
// Session-Cookies — sonst Login-Schleife, weil das Cookie nie gesetzt wird.
export function isSecureRequest(req: Request): boolean {
  const xfp = req.headers.get("x-forwarded-proto");
  if (xfp) return xfp.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export type Session = JWTPayload & { email?: string };

// Erstellt ein signiertes Sitzungs-Token (7 Tage gültig).
export async function createSession(payload: { email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// Prüft ein Token; gibt die Sitzung zurück oder null, wenn ungültig/abgelaufen.
export async function verifySession(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Session;
  } catch {
    return null;
  }
}
