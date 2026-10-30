// lib/zentrale/mail/konten.ts — Postfächer für den Versand (SMTP).
// Passwörter liegen verschlüsselt in der Datenbank. Zusätzlich gibt es ein
// optionales Postfach aus der Umgebung (SMTP_* in Coolify), damit der Versand
// auch ohne Eintrag in der App funktioniert. Es gilt nur, solange in der App
// kein Postfach eingerichtet ist.
import "server-only";
import nodemailer from "nodemailer";
import { q } from "@/lib/db";
import { zentraleBereit } from "../schema";
import { entschluesseln } from "../krypto";

export type Konto = {
  id: string | null; // null = Postfach aus der Umgebung
  name: string;
  absender_name: string;
  absender_adresse: string;
  antwort_an: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_sicher: boolean;
  smtp_user: string;
  passwort: () => string;
  signatur: string | null;
  tageslimit: number;
  standard: boolean;
};

type KontoZeile = Omit<Konto, "passwort"> & { smtp_pass_enc: string; aktiv: boolean };

export function umgebungsKonto(): Konto | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const von = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !von) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    id: null,
    name: "Postfach aus der Umgebung",
    absender_name: process.env.SMTP_FROM_NAME || "HK Growth Operator",
    absender_adresse: von,
    antwort_an: process.env.SMTP_REPLY_TO || null,
    smtp_host: host,
    smtp_port: port,
    smtp_sicher: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    smtp_user: user,
    passwort: () => pass,
    signatur: null,
    tageslimit: Number(process.env.SMTP_TAGESLIMIT || 200),
    standard: false,
  };
}

function ausZeile(z: KontoZeile): Konto {
  return { ...z, passwort: () => entschluesseln(z.smtp_pass_enc) };
}

export async function ladeKonten(): Promise<Konto[]> {
  await zentraleBereit();
  const rows = await q<KontoZeile>(
    `SELECT id, name, absender_name, absender_adresse, antwort_an, smtp_host, smtp_port, smtp_sicher,
            smtp_user, smtp_pass_enc, signatur, tageslimit, standard, aktiv
       FROM mail_konten WHERE aktiv ORDER BY standard DESC, created_at`,
  );
  const liste = rows.map(ausZeile);
  // Das Postfach aus der Umgebung ist der Rückfall, solange in der App keins eingerichtet ist.
  if (liste.length) return liste;
  const env = umgebungsKonto();
  return env ? [env] : [];
}

/** Das Konto mit dieser Kennung, sonst das Standardkonto, sonst das aus der Umgebung. */
export async function kontoFuer(id: string | null | undefined): Promise<Konto | null> {
  const konten = await ladeKonten();
  if (id) return konten.find((k) => k.id === id) ?? null;
  return konten.find((k) => k.standard) ?? konten[0] ?? null;
}

function transport(k: Konto) {
  return nodemailer.createTransport({
    host: k.smtp_host,
    port: k.smtp_port,
    secure: k.smtp_sicher,
    // 587: STARTTLS ist Pflicht, nie Klartext. Abschalten nur für lokale
    // Test-Postfächer (SMTP_TLS_PFLICHT=false), nie auf dem Server.
    requireTLS: !k.smtp_sicher && process.env.SMTP_TLS_PFLICHT !== "false",
    auth: { user: k.smtp_user, pass: k.passwort() },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

export async function testeKonto(k: Konto): Promise<{ ok: boolean; meldung: string }> {
  try {
    await transport(k).verify();
    return { ok: true, meldung: "Anmeldung am Mailserver erfolgreich." };
  } catch (e) {
    return { ok: false, meldung: (e as Error).message };
  }
}

export async function sende(k: Konto, mail: { an: string; betreff: string; text: string; id: string }): Promise<string> {
  const info = await transport(k).sendMail({
    from: { name: k.absender_name, address: k.absender_adresse },
    to: mail.an,
    replyTo: k.antwort_an || undefined,
    subject: mail.betreff,
    text: mail.text,
    headers: { "X-HK-Cockpit-Mail": mail.id },
  });
  return info.messageId;
}
