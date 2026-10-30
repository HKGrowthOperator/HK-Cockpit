// lib/zentrale/github.ts — liest den Zustand der Repositories über die
// GitHub-REST-API. Nur lesend. Der Token kommt aus GITHUB_TOKEN oder wird von
// der Geschäftsführung in den Einstellungen hinterlegt (verschlüsselt).
//
// Ohne Token bleibt alles ruhig: die Seiten zeigen „GitHub nicht verbunden“
// statt Fehlern. Ergebnisse werden fünf Minuten gemerkt (Rate-Limit schonen).
import "server-only";
import { getSecret } from "@/lib/secrets";
import { entschluesseln } from "./krypto";
import { ORG } from "./register";

export const GITHUB_SECRET_KEY = "zentrale_github_token";
const MERKEN_MS = 5 * 60_000;
const API = "https://api.github.com";

export type Commit = { sha: string; nachricht: string; autor: string; zeit: string; url: string };
export type PullRequest = { nummer: number; titel: string; autor: string; zeit: string; url: string; entwurf: boolean };
export type CiLauf = { name: string; zustand: string; ergebnis: string | null; zeit: string; url: string };
export type RepoStand = {
  repo: string;
  url: string;
  privat: boolean;
  standardZweig: string;
  zuletztGepusht: string | null;
  offeneIssues: number;
  commits: Commit[];
  pullRequests: PullRequest[];
  ci: CiLauf | null;
};
export type OrgRepo = { name: string; privat: boolean; fork: boolean; gepusht: string | null; url: string; beschreibung: string | null };

type Merk<T> = { wert: T; zeit: number };
const merker = new Map<string, Merk<unknown>>();

export async function githubToken(): Promise<string | null> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const gespeichert = await getSecret<{ enc: string }>(GITHUB_SECRET_KEY);
    return gespeichert?.enc ? entschluesseln(gespeichert.enc) : null;
  } catch {
    return null;
  }
}

export class GithubFehler extends Error {
  constructor(public status: number, meldung: string) { super(meldung); }
}

async function hole<T>(pfad: string, token: string): Promise<T> {
  const schl = pfad;
  const alt = merker.get(schl) as Merk<T> | undefined;
  if (alt && Date.now() - alt.zeit < MERKEN_MS) return alt.wert;
  const res = await fetch(API + pfad, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "HK-Cockpit-Zentrale",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = res.status === 401 ? "Token ungültig oder abgelaufen"
      : res.status === 403 ? "kein Zugriff oder Rate-Limit erreicht"
      : res.status === 404 ? "Repository nicht gefunden oder kein Zugriff"
      : `GitHub antwortet mit ${res.status}`;
    throw new GithubFehler(res.status, text);
  }
  const wert = (await res.json()) as T;
  merker.set(schl, { wert, zeit: Date.now() });
  return wert;
}

type GhRepo = { html_url: string; private: boolean; default_branch: string; pushed_at: string | null; open_issues_count: number };
type GhCommit = { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null }; author: { login: string } | null };
type GhPull = { number: number; title: string; html_url: string; created_at: string; draft: boolean; user: { login: string } | null };
type GhRuns = { workflow_runs: { name: string; status: string; conclusion: string | null; html_url: string; created_at: string }[] };

export async function repoStand(repo: string, token: string): Promise<RepoStand> {
  const [r, commits, pulls, runs] = await Promise.all([
    hole<GhRepo>(`/repos/${repo}`, token),
    hole<GhCommit[]>(`/repos/${repo}/commits?per_page=5`, token).catch(() => [] as GhCommit[]),
    hole<GhPull[]>(`/repos/${repo}/pulls?state=open&per_page=20`, token).catch(() => [] as GhPull[]),
    hole<GhRuns>(`/repos/${repo}/actions/runs?per_page=1`, token).catch(() => ({ workflow_runs: [] })),
  ]);
  const lauf = runs.workflow_runs[0];
  return {
    repo,
    url: r.html_url,
    privat: r.private,
    standardZweig: r.default_branch,
    zuletztGepusht: r.pushed_at,
    // GitHub zählt offene PRs in open_issues_count mit.
    offeneIssues: Math.max(0, r.open_issues_count - pulls.length),
    commits: commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      nachricht: c.commit.message.split("\n")[0],
      autor: c.author?.login || c.commit.author?.name || "unbekannt",
      zeit: c.commit.author?.date || "",
      url: c.html_url,
    })),
    pullRequests: pulls.map((p) => ({
      nummer: p.number, titel: p.title, autor: p.user?.login || "unbekannt",
      zeit: p.created_at, url: p.html_url, entwurf: p.draft,
    })),
    ci: lauf ? { name: lauf.name, zustand: lauf.status, ergebnis: lauf.conclusion, zeit: lauf.created_at, url: lauf.html_url } : null,
  };
}

export type StandOderFehler = { repo: string; stand?: RepoStand; fehler?: string };

/** Mehrere Repositories, höchstens vier gleichzeitig. Fehler je Repo, nie gesamt. */
export async function repoStaende(repos: string[]): Promise<{ verbunden: boolean; liste: StandOderFehler[] }> {
  const token = await githubToken();
  if (!token) return { verbunden: false, liste: repos.map((repo) => ({ repo })) };
  const liste: StandOderFehler[] = new Array(repos.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(4, repos.length) }, async () => {
    while (i < repos.length) {
      const n = i++;
      try { liste[n] = { repo: repos[n], stand: await repoStand(repos[n], token) }; }
      catch (e) { liste[n] = { repo: repos[n], fehler: (e as Error).message }; }
    }
  }));
  return { verbunden: true, liste };
}

type GhOrgRepo = { name: string; private: boolean; fork: boolean; pushed_at: string | null; html_url: string; description: string | null };

/** Alle Repositories der Organisation (für „Noch einzuordnen“). */
export async function orgRepos(): Promise<{ verbunden: boolean; repos: OrgRepo[]; fehler?: string }> {
  const token = await githubToken();
  if (!token) return { verbunden: false, repos: [] };
  try {
    const alle: GhOrgRepo[] = [];
    for (let seite = 1; seite <= 5; seite++) {
      const teil = await hole<GhOrgRepo[]>(`/orgs/${ORG}/repos?type=all&per_page=100&page=${seite}`, token);
      alle.push(...teil);
      if (teil.length < 100) break;
    }
    return {
      verbunden: true,
      repos: alle.map((r) => ({ name: r.name, privat: r.private, fork: r.fork, gepusht: r.pushed_at, url: r.html_url, beschreibung: r.description })),
    };
  } catch (e) {
    return { verbunden: true, repos: [], fehler: (e as Error).message };
  }
}

/** Prüft einen Token, bevor er gespeichert wird. */
export async function tokenTesten(token: string): Promise<{ ok: boolean; meldung: string }> {
  try {
    const res = await fetch(`${API}/orgs/${ORG}/repos?per_page=1`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "HK-Cockpit-Zentrale" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, meldung: "Verbindung steht." };
    return { ok: false, meldung: res.status === 401 ? "Token wird abgelehnt." : `GitHub antwortet mit ${res.status}.` };
  } catch (e) {
    return { ok: false, meldung: (e as Error).message };
  }
}

export function vergesseGithub(): void {
  merker.clear();
}
