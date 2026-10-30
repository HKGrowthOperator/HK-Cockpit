// lib/zentrale/mail/ausgang.ts — der Mail-Ausgang: Entwurf → Freigabe → Versand.
//
// Grundsatz wie in allen HK-Apps: Was nach außen geht, gibt ein Mensch frei.
// Automatisch geht nur raus, was eine Regel der Geschäftsführung ausdrücklich
// erlaubt UND mit einer Vorlage in genau der freigegebenen Fassung erzeugt
// wurde. Jede Mail trägt einen Idempotenz-Schlüssel; derselbe Anlass erzeugt
// nie zwei Mails.
import "server-only";
import { pool, q } from "@/lib/db";
import { zentraleBereit } from "../schema";
import { findeApp } from "../register";
import type { Ereignis } from "../ereignisse";
import { kontoFuer, sende } from "./konten";
import { einzeilig, entscheide, fuelle, gueltigeAdresse, istFreigegeben, mitSignatur } from "./vorlage";

export type AusgangStatus = "entwurf" | "wartet" | "freigegeben" | "sendet" | "gesendet" | "fehler" | "verworfen";

export type AusgangZeile = {
  id: string; an: string; betreff: string; text: string; status: AusgangStatus;
  herkunft: string; faellig_am: string; erstellt_von: string | null;
  freigegeben_von: string | null; freigegeben_am: string | null; gesendet_am: string | null;
  fehler: string | null; versuche: number; created_at: string;
  konto_id: string | null; konto_name: string | null; regel_name: string | null;
  ereignis_titel: string | null; app_id: string | null; geplant: boolean;
};

type Regel = {
  id: string; name: string; app_id: string; art: string; empfaenger: string;
  modus: "freigabe" | "automatisch"; verzoegerung_min: number; konto_id: string | null;
  v_betreff: string; v_text: string; v_freigabe_hash: string | null; vorlage_id: string;
};

/** Mail-Regeln für ein neues Ereignis anwenden. Gibt die Zahl neuer Mails zurück. */
export async function regelnAnwenden(e: Ereignis): Promise<number> {
  await zentraleBereit();
  const regeln = await q<Regel>(
    `SELECT r.id, r.name, r.app_id, r.art, r.empfaenger, r.modus, r.verzoegerung_min, r.konto_id,
            v.id AS vorlage_id, v.betreff AS v_betreff, v.text AS v_text, v.freigabe_hash AS v_freigabe_hash
       FROM mail_regeln r JOIN mail_vorlagen v ON v.id = r.vorlage_id
      WHERE r.aktiv AND r.app_id = $1 AND (r.art = $2 OR r.art = '*')`,
    [e.app_id, e.art],
  );
  const werte = { ...e.daten, daten: e.daten, ereignis: { art: e.art, app: e.app_id, titel: e.titel, eingang: e.eingang } };
  const ausEigenstaendiger = findeApp(e.app_id)?.rolle === "eigenstaendig";
  let neu = 0;
  for (const r of regeln) {
    const konto = await kontoFuer(r.konto_id);
    const an = fuelle(r.empfaenger, werte);
    const betreff = fuelle(r.v_betreff, werte);
    const text = fuelle(r.v_text, werte);
    const fehlend = [...new Set([...an.fehlend, ...betreff.fehlend, ...text.fehlend])];
    const ent = entscheide({
      modus: r.modus,
      vorlageFreigegeben: istFreigegeben({ betreff: r.v_betreff, text: r.v_text, freigabe_hash: r.v_freigabe_hash }),
      empfaenger: an.text.trim(),
      fehlend,
      ausEigenstaendigerApp: ausEigenstaendiger,
      absenderAdresse: konto?.absender_adresse ?? null,
    });
    const ins = await pool.query(
      `INSERT INTO mail_ausgang (konto_id, vorlage_id, regel_id, ereignis_id, herkunft, an, betreff, text,
                                 status, faellig_am, schluessel, erstellt_von, freigegeben_von, freigegeben_am, fehler)
       VALUES ($1,$2,$3,$4,'regel',$5,$6,$7,$8, now() + ($9 || ' minutes')::interval, $10, $11, $12,
               CASE WHEN $8 = 'freigegeben' THEN now() END, $13)
       ON CONFLICT (schluessel) DO NOTHING`,
      [
        konto?.id ?? null, r.vorlage_id, r.id, e.id, einzeilig(an.text), einzeilig(betreff.text),
        mitSignatur(text.text, konto?.signatur), ent.status, String(r.verzoegerung_min),
        `regel:${r.id}:${e.id}`, `Regel „${r.name}“`,
        ent.status === "freigegeben" ? `Regel „${r.name}“ (automatisch)` : null,
        ent.status === "freigegeben" ? null : ent.grund,
      ],
    );
    neu += ins.rowCount ?? 0;
  }
  return neu;
}

/** Eine Mail von Hand anlegen. `sofort` = der Verfasser gibt sie direkt frei. */
export async function mailAnlegen(m: {
  kontoId: string | null; an: string; betreff: string; text: string; von: string;
  sofort: boolean; schluessel: string; herkunft?: string; vorlageId?: string | null;
}): Promise<{ id: string | null; neu: boolean }> {
  await zentraleBereit();
  const konto = await kontoFuer(m.kontoId);
  const res = await pool.query<{ id: string }>(
    `INSERT INTO mail_ausgang (konto_id, vorlage_id, herkunft, an, betreff, text, status, schluessel,
                               erstellt_von, freigegeben_von, freigegeben_am)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $7 = 'freigegeben' THEN $9 END,
             CASE WHEN $7 = 'freigegeben' THEN now() END)
     ON CONFLICT (schluessel) DO NOTHING RETURNING id`,
    [
      konto?.id ?? null, m.vorlageId ?? null, m.herkunft ?? "hand", einzeilig(m.an), einzeilig(m.betreff),
      mitSignatur(m.text, konto?.signatur), m.sofort ? "freigegeben" : "entwurf", m.schluessel, m.von,
    ],
  );
  return { id: res.rows[0]?.id ?? null, neu: res.rowCount === 1 };
}

export async function mailAendern(id: string, d: { an: string; betreff: string; text: string; kontoId: string | null }): Promise<boolean> {
  await zentraleBereit();
  // Nur solange niemand freigegeben hat; eine Änderung macht aus „wartet“ wieder einen Entwurf.
  const res = await pool.query(
    `UPDATE mail_ausgang SET an = $2, betreff = $3, text = $4, konto_id = $5, status = 'entwurf',
            fehler = NULL, updated_at = now()
      WHERE id = $1 AND status IN ('entwurf','wartet','fehler')`,
    [id, einzeilig(d.an), einzeilig(d.betreff), d.text, d.kontoId],
  );
  return res.rowCount === 1;
}

export async function freigeben(id: string, von: string): Promise<boolean> {
  await zentraleBereit();
  const res = await pool.query(
    `UPDATE mail_ausgang SET status = 'freigegeben', freigegeben_von = $2, freigegeben_am = now(),
            fehler = NULL, updated_at = now()
      WHERE id = $1 AND status IN ('entwurf','wartet','fehler')`,
    [id, von],
  );
  return res.rowCount === 1;
}

export async function verwerfen(id: string): Promise<boolean> {
  await zentraleBereit();
  const res = await pool.query(
    `UPDATE mail_ausgang SET status = 'verworfen', updated_at = now()
      WHERE id = $1 AND status IN ('entwurf','wartet','freigegeben','fehler')`,
    [id],
  );
  return res.rowCount === 1;
}

/**
 * Versand, der mitten im Senden abgebrochen ist (Neustart, Absturz), wird NICHT
 * erneut gesendet: Ob die Mail draußen ist, weiß niemand. Ein Mensch schaut im
 * Postfach nach und gibt bei Bedarf neu frei.
 */
export async function haengendeAufklaeren(): Promise<number> {
  await zentraleBereit();
  const res = await pool.query(
    `UPDATE mail_ausgang SET status = 'fehler', updated_at = now(),
            fehler = 'Versand wurde unterbrochen. Bitte im Postfach unter „Gesendet“ prüfen, bevor du erneut freigibst.'
      WHERE status = 'sendet' AND updated_at < now() - interval '15 minutes'`,
  );
  return res.rowCount ?? 0;
}

type Zugeteilt = { id: string; konto_id: string | null; an: string; betreff: string; text: string };

/** Fällige, freigegebene Mails senden. Mehrere Prozesse greifen nie dieselbe Mail. */
export async function versendeFaellige(limit = 20): Promise<{ gesendet: number; fehler: number }> {
  await zentraleBereit();
  await haengendeAufklaeren();
  const { rows } = await pool.query<Zugeteilt>(
    `UPDATE mail_ausgang SET status = 'sendet', versuche = versuche + 1, updated_at = now()
      WHERE id IN (SELECT id FROM mail_ausgang WHERE status = 'freigegeben' AND faellig_am <= now()
                    ORDER BY faellig_am LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, konto_id, an, betreff, text`,
    [limit],
  );
  let gesendet = 0, fehler = 0;
  for (const m of rows) {
    try {
      // Auch ein von Hand freigegebener Entwurf geht nur an genau eine gültige Adresse.
      if (!gueltigeAdresse(m.an)) throw new Error("Empfänger ist keine gültige Adresse. Bitte bearbeiten.");
      const konto = await kontoFuer(m.konto_id);
      if (!konto) throw new Error("Kein Postfach verfügbar.");
      const heute = await q<{ n: number }>(
        `SELECT count(*)::int AS n FROM mail_ausgang
          WHERE status = 'gesendet' AND gesendet_am >= date_trunc('day', now())
            AND konto_id IS NOT DISTINCT FROM $1`,
        [konto.id],
      );
      if ((heute[0]?.n ?? 0) >= konto.tageslimit) {
        // Kein Fehler: morgen geht es weiter.
        await pool.query(
          `UPDATE mail_ausgang SET status = 'freigegeben', versuche = versuche - 1,
                  faellig_am = date_trunc('day', now()) + interval '1 day 7 hours', updated_at = now()
            WHERE id = $1`,
          [m.id],
        );
        continue;
      }
      const messageId = await sende(konto, m);
      await pool.query(
        `UPDATE mail_ausgang SET status = 'gesendet', gesendet_am = now(), message_id = $2, fehler = NULL,
                konto_id = $3, updated_at = now() WHERE id = $1`,
        [m.id, messageId, konto.id],
      );
      gesendet++;
    } catch (e) {
      await pool.query(
        "UPDATE mail_ausgang SET status = 'fehler', fehler = $2, updated_at = now() WHERE id = $1",
        [m.id, (e as Error).message.slice(0, 500)],
      );
      fehler++;
    }
  }
  return { gesendet, fehler };
}

export async function ladeAusgang(filter: "offen" | "gesendet" | "alle" = "offen", limit = 100): Promise<AusgangZeile[]> {
  await zentraleBereit();
  const bed = filter === "offen"
    ? "a.status IN ('entwurf','wartet','freigegeben','sendet','fehler')"
    : filter === "gesendet" ? "a.status IN ('gesendet','verworfen')" : "true";
  return q<AusgangZeile>(
    `SELECT a.id, a.an, a.betreff, a.text, a.status, a.herkunft, a.faellig_am::text, a.erstellt_von,
            a.freigegeben_von, a.freigegeben_am::text, a.gesendet_am::text, a.fehler, a.versuche,
            a.created_at::text, a.konto_id, k.name AS konto_name, r.name AS regel_name,
            e.titel AS ereignis_titel, e.app_id, a.faellig_am > now() AS geplant
       FROM mail_ausgang a
       LEFT JOIN mail_konten k ON k.id = a.konto_id
       LEFT JOIN mail_regeln r ON r.id = a.regel_id
       LEFT JOIN ereignisse e ON e.id = a.ereignis_id
      WHERE ${bed}
      ORDER BY CASE a.status WHEN 'fehler' THEN 0 WHEN 'wartet' THEN 1 WHEN 'entwurf' THEN 2 ELSE 3 END,
               a.created_at DESC
      LIMIT $1`,
    [limit],
  );
}

export async function ausgangZahlen(): Promise<Record<AusgangStatus, number>> {
  await zentraleBereit();
  const rows = await q<{ status: AusgangStatus; n: number }>(
    `SELECT status, count(*)::int AS n FROM mail_ausgang
      WHERE status <> 'gesendet' OR gesendet_am >= now() - interval '7 days' GROUP BY status`,
  );
  const z = { entwurf: 0, wartet: 0, freigegeben: 0, sendet: 0, gesendet: 0, fehler: 0, verworfen: 0 };
  for (const r of rows) z[r.status] = r.n;
  return z;
}
