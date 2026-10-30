"use server";
// lib/zentrale/aktionen.ts — alle schreibenden Handgriffe der Zentrale.
// Jede Aktion prüft selbst, wer angemeldet ist, und was er darf.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pool, q } from "@/lib/db";
import { delSecret, setSecret } from "@/lib/secrets";
import { zentraleBereit } from "./schema";
import { gfPflicht, nutzerPflicht } from "./nutzer";
import { ladeApp, pruefeAdresse } from "./apps";
import { findeApp, BEREICHE, type Bereich } from "./register";
import { neuesGeheimnis, verschluesseln } from "./krypto";
import { GITHUB_SECRET_KEY, tokenTesten, vergesseGithub } from "./github";
import { pruefe } from "./health";
import { freigeben, mailAendern, mailAnlegen, verwerfen, versendeFaellige } from "./mail/ausgang";
import { kontoFuer, testeKonto, type Konto } from "./mail/konten";
import { gueltigeAdresse, vorlagenHash } from "./mail/vorlage";

export type Antwort = { ok: boolean; meldung: string; wert?: string };

async function versuche(f: () => Promise<Antwort>, pfade: string[] = []): Promise<Antwort> {
  try {
    const a = await f();
    for (const p of pfade) revalidatePath(p);
    return a;
  } catch (e) {
    return { ok: false, meldung: (e as Error).message };
  }
}

const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ── Apps ────────────────────────────────────────────────────────────────────

export async function appEinstellungSpeichern(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    const n = await nutzerPflicht();
    const appId = t(fd, "app_id");
    if (!(await ladeApp(appId))) throw new Error("Unbekannte App.");
    const url = pruefeAdresse(t(fd, "url"));
    const health = pruefeAdresse(t(fd, "health"), { pfadErlaubt: true });
    const coolify = pruefeAdresse(t(fd, "coolify_url"));
    const notiz = t(fd, "notiz").slice(0, 2000) || null;
    await zentraleBereit();
    await pool.query(
      `INSERT INTO zentrale_app_einstellungen (app_id, url, health, coolify_url, notiz, geaendert_von)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (app_id) DO UPDATE SET url = $2, health = $3, coolify_url = $4, notiz = $5,
              geaendert_von = $6, updated_at = now()`,
      [appId, url, health, coolify, notiz, n.email],
    );
    return { ok: true, meldung: "Gespeichert." };
  }, ["/", "/apps", `/apps/${t(fd, "app_id")}`]);
}

export async function healthNeuPruefen(appId: string): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    const app = await ladeApp(appId);
    if (!app) throw new Error("Unbekannte App.");
    const p = await pruefe(app.healthUrl ?? app.urlAufgeloest, { frisch: true });
    return { ok: p.zustand === "ok" || p.zustand === "langsam", meldung: p.meldung ?? `HTTP ${p.code} in ${p.ms} ms` };
  }, ["/", "/apps", `/apps/${appId}`]);
}

/** Neues Geheimnis für eingehende Ereignisse. Wird genau einmal angezeigt. */
export async function ereignisGeheimnisErzeugen(appId: string): Promise<Antwort> {
  return versuche(async () => {
    const n = await gfPflicht();
    const app = findeApp(appId);
    if (!app?.ereignisse) throw new Error("Diese App sendet keine Ereignisse.");
    const geheimnis = neuesGeheimnis();
    await zentraleBereit();
    await pool.query(
      `INSERT INTO zentrale_app_einstellungen (app_id, ereignis_secret, geaendert_von) VALUES ($1,$2,$3)
       ON CONFLICT (app_id) DO UPDATE SET ereignis_secret = $2, geaendert_von = $3, updated_at = now()`,
      [appId, verschluesseln(geheimnis), n.email],
    );
    return { ok: true, meldung: "Neues Geheimnis erzeugt. Es wird nur jetzt angezeigt.", wert: geheimnis };
  }, [`/apps/${appId}`, "/einstellungen"]);
}

export async function repoZuordnen(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    const n = await gfPflicht();
    const repo = t(fd, "repo");
    const art = t(fd, "art");
    const bereich = t(fd, "bereich") as Bereich;
    if (!/^[\w.-]{1,100}$/.test(repo)) throw new Error("Ungültiger Repository-Name.");
    if (!["intern", "produkt", "kunde", "abgelegt"].includes(art)) throw new Error("Ungültige Zuordnung.");
    if (bereich && !BEREICHE.includes(bereich)) throw new Error("Ungültiger Bereich.");
    await zentraleBereit();
    await pool.query(
      `INSERT INTO zentrale_repo_zuordnung (repo, art, bereich, notiz, entschieden_von) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (repo) DO UPDATE SET art = $2, bereich = $3, notiz = $4, entschieden_von = $5, updated_at = now()`,
      [repo, art, bereich || null, t(fd, "notiz").slice(0, 300) || null, n.email],
    );
    return { ok: true, meldung: `${repo} eingeordnet.` };
  }, ["/", "/apps"]);
}

// ── GitHub ──────────────────────────────────────────────────────────────────

export async function githubTokenSpeichern(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    await gfPflicht();
    const token = t(fd, "token");
    if (!token) throw new Error("Bitte einen Token eintragen.");
    const test = await tokenTesten(token);
    if (!test.ok) return test;
    await setSecret(GITHUB_SECRET_KEY, { enc: verschluesseln(token) });
    vergesseGithub();
    return { ok: true, meldung: "GitHub verbunden." };
  }, ["/", "/apps", "/einstellungen"]);
}

export async function githubTokenLoeschen(): Promise<Antwort> {
  return versuche(async () => {
    await gfPflicht();
    await delSecret(GITHUB_SECRET_KEY);
    vergesseGithub();
    return { ok: true, meldung: "GitHub-Verbindung entfernt." };
  }, ["/", "/apps", "/einstellungen"]);
}

// ── Mail: Postfächer ────────────────────────────────────────────────────────

export async function kontoSpeichern(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    await gfPflicht();
    const id = t(fd, "id") || null;
    const absender = t(fd, "absender_adresse");
    if (!gueltigeAdresse(absender)) throw new Error("Absenderadresse ist ungültig.");
    const antwortAn = t(fd, "antwort_an");
    if (antwortAn && !gueltigeAdresse(antwortAn)) throw new Error("Antwort-an-Adresse ist ungültig.");
    const host = t(fd, "smtp_host");
    if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error("SMTP-Server ist ungültig.");
    const port = Number(t(fd, "smtp_port") || 587);
    if (![25, 465, 587, 2525].includes(port)) throw new Error("Port muss 465, 587, 2525 oder 25 sein.");
    const pass = String(fd.get("smtp_pass") ?? "");
    if (!id && !pass) throw new Error("Passwort fehlt.");
    const werte = {
      name: t(fd, "name") || absender,
      absender_name: t(fd, "absender_name") || "HK Growth Operator",
      absender_adresse: absender,
      antwort_an: antwortAn || null,
      smtp_host: host,
      smtp_port: port,
      smtp_sicher: port === 465,
      smtp_user: t(fd, "smtp_user") || absender,
      signatur: String(fd.get("signatur") ?? "").trim().slice(0, 2000) || null,
      tageslimit: Math.max(1, Math.min(2000, Number(t(fd, "tageslimit") || 200))),
      standard: fd.get("standard") === "on",
    };
    // Vor dem Speichern anmelden: ein Postfach, das nicht senden kann, bringt nichts.
    const passwortZumTest = pass || (id ? (await kontoFuer(id))?.passwort() ?? "" : "");
    const probe: Konto = { ...werte, id, passwort: () => passwortZumTest };
    const test = await testeKonto(probe);
    if (!test.ok) return { ok: false, meldung: `Mailserver lehnt ab: ${test.meldung}` };

    await zentraleBereit();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (werte.standard) await client.query("UPDATE mail_konten SET standard = false");
      const spalten = [werte.name, werte.absender_name, werte.absender_adresse, werte.antwort_an, werte.smtp_host,
        werte.smtp_port, werte.smtp_sicher, werte.smtp_user, werte.signatur, werte.tageslimit, werte.standard];
      if (id) {
        await client.query(
          `UPDATE mail_konten SET name=$2, absender_name=$3, absender_adresse=$4, antwort_an=$5, smtp_host=$6,
                  smtp_port=$7, smtp_sicher=$8, smtp_user=$9, signatur=$10, tageslimit=$11, standard=$12,
                  smtp_pass_enc = COALESCE($13, smtp_pass_enc)
            WHERE id = $1`,
          [id, ...spalten, pass ? verschluesseln(pass) : null],
        );
      } else {
        await client.query(
          `INSERT INTO mail_konten (name, absender_name, absender_adresse, antwort_an, smtp_host, smtp_port,
                  smtp_sicher, smtp_user, signatur, tageslimit, standard, smtp_pass_enc)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [...spalten, verschluesseln(pass)],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return { ok: true, meldung: "Postfach gespeichert — Anmeldung am Mailserver erfolgreich." };
  }, ["/mail/konten", "/mail"]);
}

export async function kontoDeaktivieren(id: string): Promise<Antwort> {
  return versuche(async () => {
    await gfPflicht();
    await zentraleBereit();
    await pool.query("UPDATE mail_konten SET aktiv = false, standard = false WHERE id = $1", [id]);
    return { ok: true, meldung: "Postfach entfernt." };
  }, ["/mail/konten"]);
}

// ── Mail: Vorlagen ──────────────────────────────────────────────────────────

export async function vorlageSpeichern(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    const id = t(fd, "id") || null;
    const name = t(fd, "name");
    const betreff = t(fd, "betreff");
    const text = String(fd.get("text") ?? "").replace(/\r\n/g, "\n").trim();
    if (!name || !betreff || !text) throw new Error("Name, Betreff und Text sind Pflicht.");
    await zentraleBereit();
    if (id) {
      // Die Freigabe bleibt als Fingerabdruck stehen — passt der Text nicht mehr
      // dazu, gilt die Vorlage automatisch als nicht freigegeben.
      await pool.query(
        "UPDATE mail_vorlagen SET name=$2, zweck=$3, betreff=$4, text=$5, updated_at=now() WHERE id=$1",
        [id, name, t(fd, "zweck") || null, betreff, text],
      );
    } else {
      await pool.query(
        "INSERT INTO mail_vorlagen (name, zweck, betreff, text) VALUES ($1,$2,$3,$4)",
        [name, t(fd, "zweck") || null, betreff, text],
      );
    }
    return { ok: true, meldung: "Vorlage gespeichert." };
  }, ["/mail/vorlagen"]);
}

export async function vorlageFreigeben(id: string): Promise<Antwort> {
  return versuche(async () => {
    const n = await gfPflicht();
    await zentraleBereit();
    const rows = await q<{ betreff: string; text: string }>("SELECT betreff, text FROM mail_vorlagen WHERE id = $1", [id]);
    const v = rows[0];
    if (!v) throw new Error("Vorlage nicht gefunden.");
    await pool.query(
      "UPDATE mail_vorlagen SET freigabe_hash=$2, freigegeben_von=$3, freigegeben_am=now() WHERE id=$1",
      [id, vorlagenHash(v.betreff, v.text), n.email],
    );
    return { ok: true, meldung: "Vorlage in dieser Fassung freigegeben." };
  }, ["/mail/vorlagen", "/mail/regeln"]);
}

export async function vorlageLoeschen(id: string): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    await zentraleBereit();
    const genutzt = await q<{ n: number }>("SELECT count(*)::int AS n FROM mail_regeln WHERE vorlage_id = $1", [id]);
    if ((genutzt[0]?.n ?? 0) > 0) throw new Error("Vorlage wird von einer Regel genutzt. Erst die Regel löschen.");
    await pool.query("DELETE FROM mail_vorlagen WHERE id = $1", [id]);
    return { ok: true, meldung: "Vorlage gelöscht." };
  }, ["/mail/vorlagen"]);
}

// ── Mail: Regeln ────────────────────────────────────────────────────────────

export async function regelSpeichern(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    const n = await nutzerPflicht();
    const id = t(fd, "id") || null;
    const appId = t(fd, "app_id");
    const app = findeApp(appId);
    if (!app?.ereignisse) throw new Error("Diese App sendet keine Ereignisse.");
    const art = t(fd, "art");
    if (!/^(\*|[a-z][\w.-]{0,63})$/i.test(art)) throw new Error("Ungültige Ereignisart.");
    const modus = t(fd, "modus") === "automatisch" ? "automatisch" : "freigabe";
    if (modus === "automatisch" && n.rolle !== "gf") throw new Error("Automatischen Versand schaltet nur die Geschäftsführung frei.");
    const empfaenger = t(fd, "empfaenger");
    if (!empfaenger) throw new Error("Empfänger fehlt (z. B. {{email}} oder team@…).");
    const verz = Math.max(0, Math.min(43200, Math.round(Number(t(fd, "verzoegerung_min") || 0))));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const vorlageId = t(fd, "vorlage_id");
    if (!uuid.test(vorlageId)) throw new Error("Bitte eine Vorlage wählen.");
    const kontoId = t(fd, "konto_id") || null;
    if (kontoId && !uuid.test(kontoId)) throw new Error("Ungültiges Postfach.");
    await zentraleBereit();
    const werte = [t(fd, "name") || `${app.name}: ${art}`, appId, art, vorlageId, kontoId, empfaenger, modus, verz];
    if (id) {
      await pool.query(
        `UPDATE mail_regeln SET name=$2, app_id=$3, art=$4, vorlage_id=$5, konto_id=$6, empfaenger=$7,
                modus=$8, verzoegerung_min=$9 WHERE id=$1`,
        [id, ...werte],
      );
    } else {
      await pool.query(
        `INSERT INTO mail_regeln (name, app_id, art, vorlage_id, konto_id, empfaenger, modus, verzoegerung_min)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        werte,
      );
    }
    return { ok: true, meldung: "Regel gespeichert." };
  }, ["/mail/regeln"]);
}

export async function regelUmschalten(id: string, aktiv: boolean): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    await zentraleBereit();
    await pool.query("UPDATE mail_regeln SET aktiv = $2 WHERE id = $1", [id, aktiv]);
    return { ok: true, meldung: aktiv ? "Regel aktiv." : "Regel pausiert." };
  }, ["/mail/regeln"]);
}

export async function regelLoeschen(id: string): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    await zentraleBereit();
    await pool.query("DELETE FROM mail_regeln WHERE id = $1", [id]);
    return { ok: true, meldung: "Regel gelöscht." };
  }, ["/mail/regeln"]);
}

// ── Mail: Ausgang ───────────────────────────────────────────────────────────

export async function mailSpeichern(_p: Antwort | null, fd: FormData): Promise<Antwort> {
  return versuche(async () => {
    const n = await nutzerPflicht();
    const id = t(fd, "id") || null;
    const an = t(fd, "an");
    const betreff = t(fd, "betreff");
    const text = String(fd.get("text") ?? "").replace(/\r\n/g, "\n").trim();
    if (!gueltigeAdresse(an)) throw new Error("Empfänger ist keine gültige Adresse.");
    if (!betreff || !text) throw new Error("Betreff und Text fehlen.");
    const kontoId = t(fd, "konto_id") || null;
    const sofort = t(fd, "absicht") === "senden";
    if (id) {
      if (!(await mailAendern(id, { an, betreff, text, kontoId }))) throw new Error("Mail ist schon unterwegs und lässt sich nicht mehr ändern.");
      if (sofort) await freigeben(id, n.email);
    } else {
      await mailAnlegen({
        kontoId, an, betreff, text, von: n.email, sofort,
        schluessel: t(fd, "schluessel") || `hand:${randomUUID()}`,
        herkunft: t(fd, "herkunft") || "hand",
        vorlageId: t(fd, "vorlage_id") || null,
      });
    }
    if (sofort) {
      const r = await versendeFaellige(5);
      return { ok: r.fehler === 0, meldung: r.fehler ? "Versand fehlgeschlagen — Details im Ausgang." : "Gesendet." };
    }
    return { ok: true, meldung: "Als Entwurf gespeichert." };
  }, ["/mail", "/"]);
}

export async function mailFreigeben(id: string): Promise<Antwort> {
  return versuche(async () => {
    const n = await nutzerPflicht();
    if (!(await freigeben(id, n.email))) throw new Error("Mail ist bereits bearbeitet.");
    const r = await versendeFaellige(5);
    return { ok: r.fehler === 0, meldung: r.gesendet ? "Freigegeben und gesendet." : r.fehler ? "Freigegeben, Versand fehlgeschlagen." : "Freigegeben — wird zum geplanten Zeitpunkt gesendet." };
  }, ["/mail", "/"]);
}

export async function mailVerwerfen(id: string): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    if (!(await verwerfen(id))) throw new Error("Mail ist bereits gesendet.");
    return { ok: true, meldung: "Verworfen." };
  }, ["/mail", "/"]);
}

export async function ausgangJetztSenden(): Promise<Antwort> {
  return versuche(async () => {
    await nutzerPflicht();
    const r = await versendeFaellige(20);
    return { ok: r.fehler === 0, meldung: `${r.gesendet} gesendet${r.fehler ? `, ${r.fehler} fehlgeschlagen` : ""}.` };
  }, ["/mail", "/"]);
}

/** Zahlungserinnerung aus den Rechnungen als Entwurf in den Ausgang. Je Rechnung und Stufe genau einmal. */
export async function mailAusRechnung(d: { rechnung: string; stufe: string; an: string; betreff: string; text: string }): Promise<Antwort> {
  return versuche(async () => {
    const n = await nutzerPflicht();
    if (!gueltigeAdresse(d.an)) throw new Error("Bitte eine gültige E-Mail-Adresse eintragen.");
    if (!d.betreff.trim() || !d.text.trim()) throw new Error("Betreff oder Text fehlt.");
    const r = await mailAnlegen({
      kontoId: null, an: d.an, betreff: d.betreff, text: d.text.trim(), von: n.email, sofort: false,
      schluessel: `rechnung:${d.rechnung.slice(0, 60)}:${d.stufe.slice(0, 30)}`, herkunft: "rechnung",
    });
    return r.neu
      ? { ok: true, meldung: "Als Entwurf im Ausgang." }
      : { ok: false, meldung: "Für diese Rechnung und Stufe liegt schon eine Mail im Ausgang." };
  }, ["/mail", "/"]);
}
