// lib/zentrale/schema.ts — Tabellen der Zentrale. Wie lib/store.ts und die
// Buchhaltung: idempotent beim ersten Zugriff angelegt, damit bestehende
// Datenbanken ohne manuellen Migrationsschritt mitwachsen. Dieselbe Definition
// liegt für frische Installationen in db/init/04-zentrale.sql.
import { pool } from "@/lib/db";

export const ZENTRALE_SQL = `
-- Nutzer: Name und Rolle. Bestehende Konten behalten ihre vollen Rechte (gf);
-- neue Teammitglieder legt scripts/create-user.mjs mit --rolle team an.
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rolle text NOT NULL DEFAULT 'gf';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_rolle_check CHECK (rolle IN ('gf','team'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ergänzungen je App aus dem Register (Adressen, die erst beim Ausrollen
-- feststehen) und das Geheimnis für eingehende Ereignisse (verschlüsselt).
CREATE TABLE IF NOT EXISTS zentrale_app_einstellungen (
    app_id          text PRIMARY KEY,
    url             text,
    health          text,
    coolify_url     text,
    notiz           text,
    ereignis_secret text,
    geaendert_von   text,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Entscheidungen über Repositories, die (noch) nicht im Register stehen.
CREATE TABLE IF NOT EXISTS zentrale_repo_zuordnung (
    repo          text PRIMARY KEY,
    art           text NOT NULL CHECK (art IN ('intern','produkt','kunde','abgelegt')),
    bereich       text,
    notiz         text,
    entschieden_von text,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Ereignis-Strom: was in den Apps passiert (Website-Anfrage, Coldmail-Antwort …).
CREATE TABLE IF NOT EXISTS ereignisse (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id     text NOT NULL,
    art        text NOT NULL,
    titel      text NOT NULL,
    daten      jsonb NOT NULL DEFAULT '{}'::jsonb,
    schluessel text NOT NULL UNIQUE,
    eingang    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ereignisse_eingang_idx ON ereignisse (eingang DESC);
CREATE INDEX IF NOT EXISTS ereignisse_app_idx ON ereignisse (app_id, art);

-- ── Mail-Zentrale ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mail_konten (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             text NOT NULL,
    absender_name    text NOT NULL,
    absender_adresse text NOT NULL,
    antwort_an       text,
    smtp_host        text NOT NULL,
    smtp_port        int  NOT NULL DEFAULT 587,
    smtp_sicher      boolean NOT NULL DEFAULT false,
    smtp_user        text NOT NULL,
    smtp_pass_enc    text NOT NULL,
    signatur         text,
    tageslimit       int  NOT NULL DEFAULT 200,
    standard         boolean NOT NULL DEFAULT false,
    aktiv            boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_vorlagen (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    zweck           text,
    betreff         text NOT NULL,
    text            text NOT NULL,
    freigabe_hash   text,
    freigegeben_von text,
    freigegeben_am  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_regeln (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text NOT NULL,
    app_id       text NOT NULL,
    art          text NOT NULL,
    vorlage_id   uuid NOT NULL REFERENCES mail_vorlagen(id) ON DELETE CASCADE,
    konto_id     uuid REFERENCES mail_konten(id) ON DELETE SET NULL,
    empfaenger   text NOT NULL,
    modus        text NOT NULL DEFAULT 'freigabe' CHECK (modus IN ('freigabe','automatisch')),
    verzoegerung_min int NOT NULL DEFAULT 0 CHECK (verzoegerung_min BETWEEN 0 AND 43200),
    aktiv        boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_ausgang (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    konto_id        uuid REFERENCES mail_konten(id) ON DELETE SET NULL,
    vorlage_id      uuid REFERENCES mail_vorlagen(id) ON DELETE SET NULL,
    regel_id        uuid REFERENCES mail_regeln(id) ON DELETE SET NULL,
    ereignis_id     uuid REFERENCES ereignisse(id) ON DELETE SET NULL,
    herkunft        text NOT NULL DEFAULT 'hand',
    an              text NOT NULL,
    betreff         text NOT NULL,
    text            text NOT NULL,
    status          text NOT NULL DEFAULT 'entwurf'
                    CHECK (status IN ('entwurf','wartet','freigegeben','sendet','gesendet','fehler','verworfen')),
    faellig_am      timestamptz NOT NULL DEFAULT now(),
    schluessel      text NOT NULL UNIQUE,
    erstellt_von    text,
    freigegeben_von text,
    freigegeben_am  timestamptz,
    gesendet_am     timestamptz,
    message_id      text,
    fehler          text,
    versuche        int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_ausgang_status_idx ON mail_ausgang (status, faellig_am);
CREATE INDEX IF NOT EXISTS mail_ausgang_created_idx ON mail_ausgang (created_at DESC);
`;

let ready: Promise<void> | null = null;

export function zentraleBereit(): Promise<void> {
  if (!ready) {
    ready = pool.query(ZENTRALE_SQL).then(() => undefined);
    // Ein Fehlschlag soll beim nächsten Aufruf neu versucht werden.
    ready.catch(() => { ready = null; });
  }
  return ready;
}
