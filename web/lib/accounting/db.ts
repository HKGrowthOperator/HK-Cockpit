// lib/accounting/db.ts — Schema und Datenzugriff der Buchhaltung.
// Das Schema wird wie bei lib/store.ts bei Bedarf angelegt (CREATE TABLE IF
// NOT EXISTS), damit kein manueller Migrationsschritt noetig ist.

import { pool } from "@/lib/db";
import { KONTENRAHMEN } from "./kontenrahmen";
import { berechneSalden } from "./salden";
import type {
  BankUmsatz, Beleg, Buchung, Konto, Kontenrahmen, KontoSaldo,
} from "./types";

let ready: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS buchhaltung_einstellungen (
      id             int PRIMARY KEY DEFAULT 1,
      kontenrahmen   text NOT NULL DEFAULT 'SKR04',
      firma          text,
      steuernummer   text,
      ust_id         text,
      kleinunternehmer boolean NOT NULL DEFAULT false,
      geschaeftsjahr_beginn int NOT NULL DEFAULT 1,
      updated_at     timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT einstellungen_singleton CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS konten (
      nummer      text PRIMARY KEY,
      bezeichnung text NOT NULL,
      art         text NOT NULL,
      steuer      text,
      gruppe      text NOT NULL,
      guv         boolean NOT NULL DEFAULT true,
      eigen       boolean NOT NULL DEFAULT false,
      aktiv       boolean NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS belege (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      belegnummer  text UNIQUE NOT NULL,
      typ          text NOT NULL,
      quelle       text NOT NULL,
      status       text NOT NULL DEFAULT 'offen',
      datum        date,
      betrag_cent  bigint,
      steuer_cent  bigint,
      waehrung     text NOT NULL DEFAULT 'EUR',
      partner      text,
      beschreibung text,
      datei_name   text,
      datei_pfad   text,
      mime_typ     text,
      quelle_meta  jsonb,
      dedup_key    text UNIQUE,
      erstellt_am  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS belege_status_idx ON belege (status, datum DESC);

    CREATE TABLE IF NOT EXISTS bank_umsaetze (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      datum            date NOT NULL,
      valuta           date,
      betrag_cent      bigint NOT NULL,
      waehrung         text NOT NULL DEFAULT 'EUR',
      partner          text,
      verwendungszweck text,
      iban             text,
      dedup_key        text UNIQUE NOT NULL,
      status           text NOT NULL DEFAULT 'offen',
      rechnung_id      text,
      buchung_id       uuid,
      erstellt_am      timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS bank_status_idx ON bank_umsaetze (status, datum DESC);

    CREATE TABLE IF NOT EXISTS buchungen (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buchungsnummer        text UNIQUE NOT NULL,
      datum                 date NOT NULL,
      buchungstext          text NOT NULL,
      betrag_cent           bigint NOT NULL CHECK (betrag_cent > 0),
      steuer_cent           bigint NOT NULL DEFAULT 0,
      steuerschluessel      text NOT NULL DEFAULT '0',
      soll_konto            text NOT NULL,
      haben_konto           text NOT NULL,
      beleg_id              uuid REFERENCES belege(id) ON DELETE SET NULL,
      rechnung_id           text,
      bank_umsatz_id        uuid REFERENCES bank_umsaetze(id) ON DELETE SET NULL,
      status                text NOT NULL DEFAULT 'gebucht',
      storniert_buchung_id  uuid,
      geschaeftsjahr        int NOT NULL,
      erstellt_am           timestamptz NOT NULL DEFAULT now(),
      erstellt_von          text,
      CONSTRAINT konten_verschieden CHECK (soll_konto <> haben_konto)
    );
    CREATE INDEX IF NOT EXISTS buchungen_datum_idx ON buchungen (geschaeftsjahr, datum);
    CREATE INDEX IF NOT EXISTS buchungen_konto_idx ON buchungen (soll_konto, haben_konto);

    -- Fortlaufende Nummernkreise (GoBD: luecken- und manipulationsfrei).
    CREATE TABLE IF NOT EXISTS nummernkreise (
      kreis  text NOT NULL,
      jahr   int  NOT NULL,
      stand  int  NOT NULL DEFAULT 0,
      PRIMARY KEY (kreis, jahr)
    );
  `);

  await pool.query(
    `INSERT INTO buchhaltung_einstellungen (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );
  await seedKonten();
}

/** Legt die Konten des gewaehlten Rahmens an (nur fehlende, nie ueberschreiben). */
async function seedKonten(): Promise<void> {
  const rahmen = await getKontenrahmen();
  const konten = KONTENRAHMEN[rahmen];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const k of konten) {
      await client.query(
        `INSERT INTO konten (nummer, bezeichnung, art, steuer, gruppe, guv, eigen)
         VALUES ($1,$2,$3,$4,$5,$6,false)
         ON CONFLICT (nummer) DO NOTHING`,
        [k.nummer, k.bezeichnung, k.art, k.steuer ?? null, k.gruppe, k.guv],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function initAccounting(): Promise<void> {
  if (!ready) ready = ensureSchema();
  return ready;
}

// ── Einstellungen ───────────────────────────────────────────────────────────

export type Einstellungen = {
  kontenrahmen: Kontenrahmen;
  firma: string | null;
  steuernummer: string | null;
  ust_id: string | null;
  kleinunternehmer: boolean;
  geschaeftsjahr_beginn: number;
};

async function getKontenrahmen(): Promise<Kontenrahmen> {
  const { rows } = await pool.query<{ kontenrahmen: string }>(
    `SELECT kontenrahmen FROM buchhaltung_einstellungen WHERE id = 1`,
  );
  const v = rows[0]?.kontenrahmen;
  return v === "SKR03" ? "SKR03" : "SKR04";
}

export async function ladeEinstellungen(): Promise<Einstellungen> {
  await initAccounting();
  const { rows } = await pool.query(
    `SELECT kontenrahmen, firma, steuernummer, ust_id, kleinunternehmer, geschaeftsjahr_beginn
       FROM buchhaltung_einstellungen WHERE id = 1`,
  );
  const r = rows[0] ?? {};
  return {
    kontenrahmen: r.kontenrahmen === "SKR03" ? "SKR03" : "SKR04",
    firma: r.firma ?? null,
    steuernummer: r.steuernummer ?? null,
    ust_id: r.ust_id ?? null,
    kleinunternehmer: !!r.kleinunternehmer,
    geschaeftsjahr_beginn: r.geschaeftsjahr_beginn ?? 1,
  };
}

export async function speichereEinstellungen(e: Partial<Einstellungen>): Promise<void> {
  await initAccounting();
  await pool.query(
    `UPDATE buchhaltung_einstellungen SET
       kontenrahmen = COALESCE($1, kontenrahmen),
       firma = COALESCE($2, firma),
       steuernummer = COALESCE($3, steuernummer),
       ust_id = COALESCE($4, ust_id),
       kleinunternehmer = COALESCE($5, kleinunternehmer),
       geschaeftsjahr_beginn = COALESCE($6, geschaeftsjahr_beginn),
       updated_at = now()
     WHERE id = 1`,
    [
      e.kontenrahmen ?? null, e.firma ?? null, e.steuernummer ?? null,
      e.ust_id ?? null, e.kleinunternehmer ?? null, e.geschaeftsjahr_beginn ?? null,
    ],
  );
  if (e.kontenrahmen) await seedKonten(); // Konten des neuen Rahmens ergaenzen
}

// ── Nummernkreise ───────────────────────────────────────────────────────────

/** Zieht die naechste Nummer atomar (kein Doppelvergeben bei Parallelzugriff). */
export async function naechsteNummer(kreis: "buchung" | "beleg", jahr: number): Promise<string> {
  const { rows } = await pool.query<{ stand: number }>(
    `INSERT INTO nummernkreise (kreis, jahr, stand) VALUES ($1, $2, 1)
     ON CONFLICT (kreis, jahr) DO UPDATE SET stand = nummernkreise.stand + 1
     RETURNING stand`,
    [kreis, jahr],
  );
  const n = String(rows[0].stand).padStart(5, "0");
  return kreis === "buchung" ? `${jahr}-${n}` : `B-${jahr}-${n}`;
}

// ── Konten ──────────────────────────────────────────────────────────────────

export async function ladeKonten(): Promise<Konto[]> {
  await initAccounting();
  const { rows } = await pool.query(
    `SELECT nummer, bezeichnung, art, steuer, gruppe, guv FROM konten
      WHERE aktiv = true ORDER BY nummer`,
  );
  return rows as Konto[];
}

export async function legeKontoAn(k: Konto): Promise<void> {
  await initAccounting();
  await pool.query(
    `INSERT INTO konten (nummer, bezeichnung, art, steuer, gruppe, guv, eigen)
     VALUES ($1,$2,$3,$4,$5,$6,true)
     ON CONFLICT (nummer) DO UPDATE SET
       bezeichnung = EXCLUDED.bezeichnung, art = EXCLUDED.art,
       steuer = EXCLUDED.steuer, gruppe = EXCLUDED.gruppe, guv = EXCLUDED.guv`,
    [k.nummer, k.bezeichnung, k.art, k.steuer ?? null, k.gruppe, k.guv],
  );
}

// ── Buchungen ───────────────────────────────────────────────────────────────

type BuchungRow = Omit<Buchung, "datum" | "erstellt_am"> & { datum: Date; erstellt_am: Date };

function mapBuchung(r: BuchungRow): Buchung {
  return {
    ...r,
    betrag_cent: Number(r.betrag_cent),
    steuer_cent: Number(r.steuer_cent),
    datum: iso(r.datum),
    erstellt_am: new Date(r.erstellt_am).toISOString(),
  };
}

function iso(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

export async function ladeBuchungen(opts: {
  jahr?: number; von?: string; bis?: string; konto?: string; limit?: number;
} = {}): Promise<Buchung[]> {
  await initAccounting();
  const w: string[] = ["status <> 'entwurf'"];
  const p: unknown[] = [];
  if (opts.jahr) { p.push(opts.jahr); w.push(`geschaeftsjahr = $${p.length}`); }
  if (opts.von) { p.push(opts.von); w.push(`datum >= $${p.length}`); }
  if (opts.bis) { p.push(opts.bis); w.push(`datum <= $${p.length}`); }
  if (opts.konto) { p.push(opts.konto); w.push(`(soll_konto = $${p.length} OR haben_konto = $${p.length})`); }
  p.push(Math.min(opts.limit ?? 500, 5000));
  const { rows } = await pool.query(
    `SELECT * FROM buchungen WHERE ${w.join(" AND ")}
      ORDER BY datum DESC, buchungsnummer DESC LIMIT $${p.length}`,
    p,
  );
  return (rows as BuchungRow[]).map(mapBuchung);
}

export async function speichereBuchung(b: Omit<Buchung, "id" | "buchungsnummer" | "erstellt_am">): Promise<Buchung> {
  await initAccounting();
  const nummer = await naechsteNummer("buchung", b.geschaeftsjahr);
  const { rows } = await pool.query(
    `INSERT INTO buchungen
       (buchungsnummer, datum, buchungstext, betrag_cent, steuer_cent, steuerschluessel,
        soll_konto, haben_konto, beleg_id, rechnung_id, bank_umsatz_id, status,
        storniert_buchung_id, geschaeftsjahr, erstellt_von)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      nummer, b.datum, b.buchungstext, b.betrag_cent, b.steuer_cent, b.steuerschluessel,
      b.soll_konto, b.haben_konto, b.beleg_id ?? null, b.rechnung_id ?? null,
      b.bank_umsatz_id ?? null, b.status, b.storniert_buchung_id ?? null,
      b.geschaeftsjahr, b.erstellt_von ?? null,
    ],
  );
  return mapBuchung(rows[0] as BuchungRow);
}

/** GoBD: Buchungen werden nicht geloescht, sondern durch Gegenbuchung storniert. */
export async function storniereBuchung(id: string, von?: string): Promise<Buchung | null> {
  await initAccounting();
  const { rows } = await pool.query(`SELECT * FROM buchungen WHERE id = $1`, [id]);
  const orig = rows[0] as BuchungRow | undefined;
  if (!orig || orig.status !== "gebucht") return null;

  const storno = await speichereBuchung({
    datum: iso(orig.datum),
    buchungstext: `Storno zu ${orig.buchungsnummer}: ${orig.buchungstext}`,
    betrag_cent: Number(orig.betrag_cent),
    steuer_cent: Number(orig.steuer_cent),
    steuerschluessel: orig.steuerschluessel,
    soll_konto: orig.haben_konto, // Konten getauscht = Gegenbuchung
    haben_konto: orig.soll_konto,
    beleg_id: orig.beleg_id,
    rechnung_id: orig.rechnung_id,
    bank_umsatz_id: orig.bank_umsatz_id,
    status: "gebucht",
    storniert_buchung_id: orig.id,
    geschaeftsjahr: orig.geschaeftsjahr,
    erstellt_von: von ?? null,
  });
  await pool.query(`UPDATE buchungen SET status = 'storniert' WHERE id = $1`, [id]);
  return storno;
}

/** Summen und Salden je Konto. Die Steueraufteilung (Erlös netto +
 *  Umsatzsteuer separat) passiert in lib/accounting/salden.ts. */
export async function ladeSalden(jahr: number): Promise<KontoSaldo[]> {
  await initAccounting();
  const [buchungen, konten, einstellungen] = await Promise.all([
    ladeBuchungen({ jahr, limit: 20000 }),
    ladeKonten(),
    ladeEinstellungen(),
  ]);
  return berechneSalden(buchungen, konten, einstellungen.kontenrahmen);
}

// ── Belege ──────────────────────────────────────────────────────────────────

function mapBeleg(r: Record<string, unknown>): Beleg {
  return {
    id: r.id as string,
    belegnummer: r.belegnummer as string,
    typ: r.typ as Beleg["typ"],
    quelle: r.quelle as Beleg["quelle"],
    status: r.status as Beleg["status"],
    datum: r.datum ? iso(r.datum as Date) : null,
    betrag_cent: r.betrag_cent == null ? null : Number(r.betrag_cent),
    steuer_cent: r.steuer_cent == null ? null : Number(r.steuer_cent),
    waehrung: (r.waehrung as string) ?? "EUR",
    partner: (r.partner as string) ?? null,
    beschreibung: (r.beschreibung as string) ?? null,
    datei_name: (r.datei_name as string) ?? null,
    datei_pfad: (r.datei_pfad as string) ?? null,
    mime_typ: (r.mime_typ as string) ?? null,
    quelle_meta: (r.quelle_meta as Record<string, unknown>) ?? null,
    erstellt_am: new Date(r.erstellt_am as string).toISOString(),
  };
}

export async function ladeBelege(status?: Beleg["status"], limit = 200): Promise<Beleg[]> {
  await initAccounting();
  const { rows } = status
    ? await pool.query(
        `SELECT * FROM belege WHERE status = $1 ORDER BY COALESCE(datum, erstellt_am::date) DESC, erstellt_am DESC LIMIT $2`,
        [status, limit],
      )
    : await pool.query(
        `SELECT * FROM belege ORDER BY COALESCE(datum, erstellt_am::date) DESC, erstellt_am DESC LIMIT $1`,
        [limit],
      );
  return rows.map(mapBeleg);
}

export async function speichereBeleg(
  b: Omit<Beleg, "id" | "belegnummer" | "erstellt_am"> & { dedup_key?: string | null },
): Promise<Beleg | null> {
  await initAccounting();
  const jahr = Number((b.datum ?? new Date().toISOString()).slice(0, 4));
  const nummer = await naechsteNummer("beleg", jahr);
  const { rows } = await pool.query(
    `INSERT INTO belege
       (belegnummer, typ, quelle, status, datum, betrag_cent, steuer_cent, waehrung,
        partner, beschreibung, datei_name, datei_pfad, mime_typ, quelle_meta, dedup_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING *`,
    [
      nummer, b.typ, b.quelle, b.status, b.datum, b.betrag_cent, b.steuer_cent,
      b.waehrung || "EUR", b.partner, b.beschreibung, b.datei_name, b.datei_pfad,
      b.mime_typ, b.quelle_meta ? JSON.stringify(b.quelle_meta) : null, b.dedup_key ?? null,
    ],
  );
  return rows[0] ? mapBeleg(rows[0]) : null; // null = Duplikat, bereits vorhanden
}

export async function setzeBelegStatus(id: string, status: Beleg["status"]): Promise<void> {
  await initAccounting();
  await pool.query(`UPDATE belege SET status = $2 WHERE id = $1`, [id, status]);
}

// ── Bankumsaetze ────────────────────────────────────────────────────────────

function mapBank(r: Record<string, unknown>): BankUmsatz {
  return {
    id: r.id as string,
    datum: iso(r.datum as Date),
    valuta: r.valuta ? iso(r.valuta as Date) : null,
    betrag_cent: Number(r.betrag_cent),
    waehrung: (r.waehrung as string) ?? "EUR",
    partner: (r.partner as string) ?? null,
    verwendungszweck: (r.verwendungszweck as string) ?? null,
    iban: (r.iban as string) ?? null,
    dedup_key: r.dedup_key as string,
    status: r.status as BankUmsatz["status"],
    rechnung_id: (r.rechnung_id as string) ?? null,
    buchung_id: (r.buchung_id as string) ?? null,
    erstellt_am: new Date(r.erstellt_am as string).toISOString(),
  };
}

export async function ladeBankUmsaetze(status?: BankUmsatz["status"], limit = 300): Promise<BankUmsatz[]> {
  await initAccounting();
  const { rows } = status
    ? await pool.query(`SELECT * FROM bank_umsaetze WHERE status = $1 ORDER BY datum DESC LIMIT $2`, [status, limit])
    : await pool.query(`SELECT * FROM bank_umsaetze ORDER BY datum DESC LIMIT $1`, [limit]);
  return rows.map(mapBank);
}

/** Fuegt Umsaetze ein; Duplikate (gleicher dedup_key) werden uebersprungen. */
export async function importiereBankUmsaetze(
  umsaetze: Array<Omit<BankUmsatz, "id" | "status" | "rechnung_id" | "buchung_id" | "erstellt_am">>,
): Promise<{ neu: number; duplikate: number }> {
  await initAccounting();
  let neu = 0;
  for (const u of umsaetze) {
    const { rowCount } = await pool.query(
      `INSERT INTO bank_umsaetze (datum, valuta, betrag_cent, waehrung, partner, verwendungszweck, iban, dedup_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (dedup_key) DO NOTHING`,
      [u.datum, u.valuta, u.betrag_cent, u.waehrung || "EUR", u.partner, u.verwendungszweck, u.iban, u.dedup_key],
    );
    if (rowCount) neu++;
  }
  return { neu, duplikate: umsaetze.length - neu };
}

export async function setzeBankStatus(
  id: string, status: BankUmsatz["status"], rechnungId?: string | null, buchungId?: string | null,
): Promise<void> {
  await initAccounting();
  await pool.query(
    `UPDATE bank_umsaetze SET status = $2, rechnung_id = COALESCE($3, rechnung_id), buchung_id = COALESCE($4, buchung_id) WHERE id = $1`,
    [id, status, rechnungId ?? null, buchungId ?? null],
  );
}
