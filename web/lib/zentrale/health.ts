// lib/zentrale/health.ts — sind die Apps erreichbar?
//
// Geprüft werden nur Adressen aus dem Register oder von angemeldeten Nutzern
// eingetragene. Trotzdem gilt: nur http(s), keine internen Netze (sonst wird
// der Erreichbarkeitstest zur Tür ins Server-Innere), kurze Frist, Ergebnis
// eine Minute im Speicher.
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type Zustand = "ok" | "langsam" | "gestoert" | "nicht-erreichbar" | "unbekannt";
export type Pruefung = { zustand: Zustand; code?: number; ms?: number; meldung?: string; zeit: number };

const LANGSAM_MS = 1500;
const FRIST_MS = 5000;
const MERKEN_MS = 60_000;
const merker = new Map<string, Pruefung>();

export function istInternesNetz(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return istInternesNetz(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function zielErlaubt(url: URL): Promise<string | null> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return "nur http(s)";
  if (process.env.ZENTRALE_ERLAUBE_INTERN === "1") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost") return "interne Adresse";
  const adressen = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (adressen.some((a) => istInternesNetz(a.address))) return "interne Adresse";
  return null;
}

export function bewerte(code: number | undefined, ms: number | undefined): Zustand {
  if (code === undefined) return "nicht-erreichbar";
  // 401/403: die App antwortet, schützt die Prüfadresse aber — sie läuft also.
  const antwortet = (code >= 200 && code < 400) || code === 401 || code === 403;
  if (antwortet) return (ms ?? 0) > LANGSAM_MS ? "langsam" : "ok";
  return "gestoert";
}

export async function pruefe(adresse: string | undefined, { frisch = false } = {}): Promise<Pruefung> {
  if (!adresse) return { zustand: "unbekannt", meldung: "keine Adresse hinterlegt", zeit: Date.now() };
  const alt = merker.get(adresse);
  if (!frisch && alt && Date.now() - alt.zeit < MERKEN_MS) return alt;

  let ergebnis: Pruefung;
  try {
    const url = new URL(adresse);
    const sperre = await zielErlaubt(url);
    if (sperre) {
      ergebnis = { zustand: "unbekannt", meldung: `nicht geprüft: ${sperre}`, zeit: Date.now() };
    } else {
      const start = Date.now();
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: { "User-Agent": "HK-Cockpit-Zentrale/1.0" },
        signal: AbortSignal.timeout(FRIST_MS),
      });
      const ms = Date.now() - start;
      await res.body?.cancel().catch(() => {});
      ergebnis = { zustand: bewerte(res.status, ms), code: res.status, ms, zeit: Date.now() };
    }
  } catch (err) {
    const e = err as Error;
    const meldung = e.name === "TimeoutError" ? `keine Antwort in ${FRIST_MS / 1000} s` : e.message;
    ergebnis = { zustand: "nicht-erreichbar", meldung, zeit: Date.now() };
  }
  merker.set(adresse, ergebnis);
  return ergebnis;
}

/** Mehrere Adressen gleichzeitig, höchstens sechs parallel. */
export async function pruefeAlle(adressen: (string | undefined)[], frisch = false): Promise<Pruefung[]> {
  const ergebnisse: Pruefung[] = new Array(adressen.length);
  let i = 0;
  const arbeiter = Array.from({ length: Math.min(6, adressen.length) }, async () => {
    while (i < adressen.length) {
      const n = i++;
      ergebnisse[n] = await pruefe(adressen[n], { frisch });
    }
  });
  await Promise.all(arbeiter);
  return ergebnisse;
}

export { ZUSTAND_TEXT } from "./health-text";
