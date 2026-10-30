// lib/zentrale/mail/vorlage.ts — reine Logik der Mail-Zentrale (ohne Datenbank,
// ohne Netz), damit sie ohne Server getestet werden kann.
import { hash } from "../krypto";

export type Werte = Record<string, unknown>;

const PLATZHALTER = /\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

function lies(werte: Werte, pfad: string): unknown {
  let w: unknown = werte;
  for (const teil of pfad.split(".")) {
    if (w == null || typeof w !== "object") return undefined;
    w = (w as Record<string, unknown>)[teil];
  }
  return w;
}

/**
 * Ersetzt {{pfad}} und {{pfad | Ersatz}}. Fehlt ein Wert ohne Ersatz, bleibt
 * die Stelle leer und der Pfad landet in `fehlend` — eine solche Mail geht
 * nie automatisch raus.
 */
export function fuelle(text: string, werte: Werte): { text: string; fehlend: string[] } {
  const fehlend: string[] = [];
  const ergebnis = text.replace(PLATZHALTER, (_m, pfad: string, ersatz?: string) => {
    const w = lies(werte, pfad);
    if (w == null || w === "" || typeof w === "object") {
      if (ersatz !== undefined) return ersatz;
      fehlend.push(pfad);
      return "";
    }
    return String(w);
  });
  return { text: ergebnis, fehlend: [...new Set(fehlend)] };
}

export function platzhalter(text: string): string[] {
  return [...new Set([...text.matchAll(PLATZHALTER)].map((m) => m[1]))];
}

/** Fingerabdruck einer Vorlage. Jede Änderung an Betreff oder Text hebt die Freigabe auf. */
export function vorlagenHash(betreff: string, text: string): string {
  return hash("vorlage-v1", betreff, text);
}

export function istFreigegeben(v: { betreff: string; text: string; freigabe_hash: string | null }): boolean {
  return Boolean(v.freigabe_hash) && v.freigabe_hash === vorlagenHash(v.betreff, v.text);
}

/** Genau eine Adresse, keine Zeilenumbrüche (sonst Kopfzeilen-Einschleusung). */
export function gueltigeAdresse(s: string): boolean {
  return /^[^\s@<>,;"\r\n]+@[^\s@<>,;"\r\n]+\.[a-z]{2,}$/i.test(s.trim());
}

export function einzeilig(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

export function domainVon(adresse: string): string {
  return adresse.trim().toLowerCase().split("@")[1] ?? "";
}

export type Entscheidung = { status: "entwurf" | "wartet" | "freigegeben"; grund: string };

/**
 * Was passiert mit einer Mail, die eine Regel erzeugt?
 *  - ohne gültigen Empfänger → Entwurf (ein Mensch muss ihn ergänzen)
 *  - Ereignis aus einer eigenständigen App (Sales App, Coldmail) → nur an
 *    interne Adressen; nach außen schreiben diese Apps selbst
 *  - automatisch nur, wenn die Regel es erlaubt, die Vorlage in genau dieser
 *    Fassung freigegeben ist und kein Platzhalter leer blieb
 *  - sonst wartet sie auf Freigabe
 */
export function entscheide(e: {
  modus: "freigabe" | "automatisch";
  vorlageFreigegeben: boolean;
  empfaenger: string;
  fehlend: string[];
  ausEigenstaendigerApp: boolean;
  absenderAdresse: string | null;
}): Entscheidung {
  if (!e.absenderAdresse) return { status: "entwurf", grund: "Kein Postfach eingerichtet." };
  if (!gueltigeAdresse(e.empfaenger)) return { status: "entwurf", grund: "Empfänger fehlt oder ist ungültig." };
  if (e.ausEigenstaendigerApp && domainVon(e.empfaenger) !== domainVon(e.absenderAdresse)) {
    return { status: "entwurf", grund: "Ereignisse aus eigenständigen Apps gehen nur an interne Adressen." };
  }
  if (e.modus !== "automatisch") return { status: "wartet", grund: "Regel verlangt Freigabe." };
  if (!e.vorlageFreigegeben) return { status: "wartet", grund: "Vorlage ist in dieser Fassung nicht freigegeben." };
  if (e.fehlend.length) return { status: "wartet", grund: `Leere Platzhalter: ${e.fehlend.join(", ")}.` };
  return { status: "freigegeben", grund: "Automatisch: freigegebene Vorlage." };
}

/** Signatur einmal anhängen. */
export function mitSignatur(text: string, signatur: string | null | undefined): string {
  const s = (signatur ?? "").trim();
  if (!s || text.includes(s)) return text;
  return `${text.trimEnd()}\n\n${s}`;
}
