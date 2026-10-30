// lib/zentrale/lage.ts — die Lage auf einen Blick: Apps mit Status und
// Repo-Stand, was einen Menschen braucht, und der gemeinsame Aktivitätsstrom.
// Jede Quelle darf fehlen; dann fehlt nur ihr Teil, nie die ganze Seite.
import "server-only";
import { q } from "@/lib/db";
import { ladeApps, type AppAnsicht } from "./apps";
import { pruefeAlle, type Pruefung } from "./health";
import { repoStaende, type RepoStand } from "./github";
import { letzteEreignisse } from "./ereignisse";
import { ausgangZahlen } from "./mail/ausgang";
import { ladeKonten } from "./mail/konten";

export type AppLage = AppAnsicht & { pruefung: Pruefung; stand?: RepoStand; standFehler?: string };

export type Lage = {
  apps: AppLage[];
  githubVerbunden: boolean;
  githubFehler?: string; // derselbe Fehler bei allen Repos = Verbindungsproblem, kein Repo-Problem
  braucht: { mailsZurFreigabe: number; mailFehler: number; gestoert: number; offenePRs: number; automationsFehler: number };
  postfachEingerichtet: boolean;
  n8nEingerichtet: boolean;
};

async function sicher<T>(f: () => Promise<T>, ersatz: T): Promise<T> {
  try { return await f(); } catch { return ersatz; }
}

export async function ladeLage({ github = true } = {}): Promise<Lage> {
  const apps = await ladeApps();
  const [pruefungen, gh, mails, konten, autoFehler] = await Promise.all([
    // Das Cockpit prüft sich nicht über das Netz: wenn diese Seite lädt, läuft es.
    pruefeAlle(apps.map((a) => (a.rolle === "zentrale" ? undefined : a.healthUrl ?? a.urlAufgeloest))),
    github
      ? sicher(() => repoStaende(apps.filter((a) => a.repo).map((a) => a.repo!)), { verbunden: false, liste: [] })
      : Promise.resolve({ verbunden: false, liste: [] as { repo: string; stand?: RepoStand; fehler?: string }[] }),
    sicher(() => ausgangZahlen(), null),
    sicher(() => ladeKonten(), []),
    sicher(async () => (await q<{ n: number }>("SELECT open_errors::int AS n FROM v_open_errors"))[0]?.n ?? 0, 0),
  ]);
  const standNach = new Map(gh.liste.map((s) => [s.repo, s]));
  const lage: AppLage[] = apps.map((a, i) => {
    const s = a.repo ? standNach.get(a.repo) : undefined;
    const pruefung: Pruefung = a.rolle === "zentrale"
      ? { zustand: "ok", meldung: "diese Seite", zeit: Date.now() }
      : pruefungen[i];
    return { ...a, pruefung, stand: s?.stand, standFehler: s?.fehler };
  });
  const fehlerListe = gh.liste.map((x) => x.fehler);
  const githubFehler = gh.verbunden && fehlerListe.length > 0 && fehlerListe.every((f) => f && f === fehlerListe[0])
    ? fehlerListe[0] : undefined;
  return {
    apps: githubFehler ? lage.map((a) => ({ ...a, standFehler: undefined })) : lage,
    githubVerbunden: gh.verbunden,
    githubFehler,
    braucht: {
      mailsZurFreigabe: (mails?.wartet ?? 0) + (mails?.entwurf ?? 0),
      mailFehler: mails?.fehler ?? 0,
      gestoert: lage.filter((a) => a.pruefung.zustand === "gestoert" || a.pruefung.zustand === "nicht-erreichbar").length,
      offenePRs: lage.reduce((n, a) => n + (a.stand?.pullRequests.length ?? 0), 0),
      automationsFehler: autoFehler,
    },
    postfachEingerichtet: konten.length > 0,
    n8nEingerichtet: Boolean(process.env.N8N_BASE_URL),
  };
}

// ── Aktivitätsstrom ─────────────────────────────────────────────────────────

export type Aktivitaet = {
  zeit: string;
  art: "ereignis" | "commit" | "mail" | "automation";
  titel: string;
  quelle: string;
  href?: string;
  extern?: boolean;
  ton?: "ok" | "warn" | "bad";
};

export async function ladeAktivitaet(lage: Lage | null, limit = 25): Promise<Aktivitaet[]> {
  const namen = new Map((lage?.apps ?? (await ladeApps())).map((a) => [a.id, a.name]));
  const [ereignisse, mails, laeufe] = await Promise.all([
    sicher(() => letzteEreignisse(limit), []),
    sicher(() => q<{ id: string; an: string; betreff: string; status: string; zeit: string; regel: string | null; herkunft: string; von: string | null }>(
      `SELECT a.id, a.an, a.betreff, a.status, COALESCE(a.gesendet_am, a.updated_at)::text AS zeit,
              r.name AS regel, a.herkunft, a.freigegeben_von AS von
         FROM mail_ausgang a LEFT JOIN mail_regeln r ON r.id = a.regel_id
        WHERE a.status IN ('gesendet','fehler','wartet') ORDER BY COALESCE(a.gesendet_am, a.updated_at) DESC LIMIT $1`, [limit]), []),
    sicher(() => q<{ automation: string; status: string; started_at: string; summary: string | null }>(
      "SELECT automation, status, started_at::text, summary FROM agent_runs ORDER BY started_at DESC LIMIT $1", [limit]), []),
  ]);
  const liste: Aktivitaet[] = [];
  for (const e of ereignisse) {
    liste.push({ zeit: e.eingang, art: "ereignis", titel: e.titel, quelle: `Ereignis aus ${namen.get(e.app_id) ?? e.app_id}`, href: "/aktivitaet?quelle=" + e.app_id });
  }
  for (const m of mails) {
    const titel = m.status === "gesendet" ? `Mail gesendet an ${m.an}` : m.status === "fehler" ? `Mail an ${m.an} nicht gesendet` : `Mail an ${m.an} wartet auf Freigabe`;
    const quelle = m.regel ? `Mail-Automation „${m.regel}“` : m.herkunft === "rechnung" ? "Zahlungserinnerung" : `Mail von ${m.von ?? "Hand"}`;
    liste.push({ zeit: m.zeit, art: "mail", titel: `${titel}: ${m.betreff}`, quelle, href: "/mail", ton: m.status === "fehler" ? "bad" : m.status === "wartet" ? "warn" : "ok" });
  }
  for (const r of laeufe) {
    liste.push({ zeit: r.started_at, art: "automation", titel: r.summary || r.automation, quelle: `n8n-Automation ${r.automation}`, href: "/automation", ton: r.status === "error" ? "bad" : r.status === "running" ? "warn" : "ok" });
  }
  for (const a of lage?.apps ?? []) {
    for (const c of a.stand?.commits.slice(0, 3) ?? []) {
      liste.push({ zeit: c.zeit, art: "commit", titel: c.nachricht, quelle: `Code in ${a.name.split(" · ")[0]} von ${c.autor}`, href: c.url, extern: true });
    }
  }
  return liste
    .filter((x) => x.zeit)
    .sort((a, b) => Date.parse(b.zeit) - Date.parse(a.zeit))
    .slice(0, limit);
}
