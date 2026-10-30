// lib/zentrale/ereignisse.ts — der Ereignis-Strom. Apps melden, was passiert
// (Website-Anfrage, Antwort in Coldmail …). Das Cockpit schreibt nie zurück;
// es nimmt entgegen, zeigt an und stößt bei Bedarf Mail-Regeln an.
import "server-only";
import { pool, q } from "@/lib/db";
import { zentraleBereit } from "./schema";
import { entschluesseln, hash, signaturGueltig } from "./krypto";
import { findeApp } from "./register";

export type Ereignis = {
  id: string; app_id: string; art: string; titel: string;
  daten: Record<string, unknown>; eingang: string;
};

// Coldmail schickt den Kontakt als data.lead, die Website flach in data.
function wer(d: Record<string, unknown>): string {
  const l = (d.lead && typeof d.lead === "object" ? d.lead : d) as Record<string, unknown>;
  const name = [s(l.first_name), s(l.last_name)].filter(Boolean).join(" ") || s(l.name);
  const firma = s(l.company);
  return [name, firma && `(${firma})`].filter(Boolean).join(" ") || s(l.email) || "unbekannt";
}

const TITEL: Record<string, (d: Record<string, unknown>) => string> = {
  "lead.created": (d) => `Neue Website-Anfrage: ${wer(d)}`,
  "lead.test": () => "Testereignis der Website",
  "reply.received": (d) => `Antwort von ${wer(d)}`,
  "lead.interested": (d) => `Interesse: ${wer(d)}`,
  "lead.meeting": (d) => `Termin gebucht: ${wer(d)}`,
  "lead.unsubscribed": (d) => `Abmeldung: ${wer(d)}`,
  "lead.bounced": (d) => `Unzustellbar: ${wer(d)}`,
  "campaign.completed": (d) => `Kampagne beendet${d.name ? `: ${s(d.name)}` : ""}`,
  "opportunity.won": (d) => `Auftrag gewonnen${d.value_eur ? ` (${s(d.value_eur)} €)` : ""}`,
  "account.triggered": (d) => `Neuer Anlass bei einer Firma${d.reason ? `: ${s(d.reason)}` : ""}`,
  "task.created": (d) => `Aufgabe: ${s(d.title) || "neu"}`,
};

function s(v: unknown): string {
  return v == null ? "" : String(v).slice(0, 120);
}

export function titelFuer(art: string, daten: Record<string, unknown>): string {
  const f = TITEL[art];
  if (f) return f(daten);
  return art.replace(/[._]/g, " ");
}

const ART = /^[a-z][a-z0-9_.-]{0,63}$/i;

export type EingangsErgebnis =
  | { ok: true; neu: boolean; id: string | null }
  | { ok: false; status: number; meldung: string };

/**
 * Prüft und speichert ein eingehendes Ereignis. Die Signatur wird über den
 * rohen Text gebildet, genau wie die Apps sie senden.
 */
export async function nimmEreignisAn(appId: string, roh: string, kopfzeilen: Headers): Promise<EingangsErgebnis> {
  const app = findeApp(appId);
  if (!app?.ereignisse) return { ok: false, status: 404, meldung: "Unbekannte Quelle." };
  if (roh.length > 256 * 1024) return { ok: false, status: 413, meldung: "Zu groß." };

  await zentraleBereit();
  const rows = await q<{ ereignis_secret: string | null }>(
    "SELECT ereignis_secret FROM zentrale_app_einstellungen WHERE app_id = $1", [appId],
  );
  const enc = rows[0]?.ereignis_secret;
  if (!enc) return { ok: false, status: 503, meldung: "Für diese App ist noch kein Geheimnis eingerichtet." };
  let geheimnis: string;
  try { geheimnis = entschluesseln(enc); } catch { return { ok: false, status: 500, meldung: "Geheimnis nicht lesbar." }; }

  if (!signaturGueltig(roh, geheimnis, kopfzeilen.get(app.ereignisse.kopf))) {
    return { ok: false, status: 401, meldung: "Signatur ungültig." };
  }

  let body: { event?: unknown; data?: unknown; sentAt?: unknown };
  try { body = JSON.parse(roh); } catch { return { ok: false, status: 400, meldung: "Kein JSON." }; }
  const art = typeof body.event === "string" ? body.event : "";
  if (!ART.test(art)) return { ok: false, status: 400, meldung: "Ereignisart fehlt." };
  const daten = body.data && typeof body.data === "object" && !Array.isArray(body.data)
    ? (body.data as Record<string, unknown>) : {};

  // Gleicher Inhalt = gleiches Ereignis: Wiederholungen der App legen nichts doppelt an.
  const schluessel = hash(appId, roh);
  const ins = await pool.query<{ id: string }>(
    `INSERT INTO ereignisse (app_id, art, titel, daten, schluessel)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (schluessel) DO NOTHING RETURNING id`,
    [appId, art, titelFuer(art, daten), JSON.stringify(daten), schluessel],
  );
  return { ok: true, neu: ins.rowCount === 1, id: ins.rows[0]?.id ?? null };
}

export async function ladeEreignis(id: string): Promise<Ereignis | null> {
  await zentraleBereit();
  const rows = await q<Ereignis>("SELECT id, app_id, art, titel, daten, eingang::text FROM ereignisse WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function letzteEreignisse(limit = 30, appId?: string): Promise<Ereignis[]> {
  await zentraleBereit();
  return appId
    ? q<Ereignis>(
        "SELECT id, app_id, art, titel, daten, eingang::text FROM ereignisse WHERE app_id = $1 ORDER BY eingang DESC LIMIT $2",
        [appId, limit],
      )
    : q<Ereignis>("SELECT id, app_id, art, titel, daten, eingang::text FROM ereignisse ORDER BY eingang DESC LIMIT $1", [limit]);
}

export async function ereignisArten(): Promise<{ app_id: string; art: string; n: number }[]> {
  await zentraleBereit();
  return q("SELECT app_id, art, count(*)::int AS n FROM ereignisse GROUP BY 1, 2 ORDER BY 1, 2");
}
