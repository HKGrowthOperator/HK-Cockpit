// lib/zentrale/apps.ts — das Register, ergänzt um das, was erst im Betrieb
// feststeht: Adressen aus der Datenbank und aus der Umgebung.
import "server-only";
import { q } from "@/lib/db";
import { zentraleBereit } from "./schema";
import { APPS, adresse, findeApp, ORG, type AppEintrag, type Bereich } from "./register";

export type AppAnsicht = AppEintrag & {
  urlAufgeloest?: string;
  healthUrl?: string;
  coolifyUrl?: string;
  notiz?: string;
  ereignisseEingerichtet: boolean;
  ausDatenbank?: boolean; // in der App aufgenommen, nicht im Katalog
};

type Einstellung = {
  app_id: string; url: string | null; health: string | null; coolify_url: string | null;
  notiz: string | null; ereignis_secret: string | null;
};
type Zuordnung = { repo: string; art: string; bereich: string | null; notiz: string | null };

// Adressen, die die Umgebung kennt, ohne dass jemand sie eintragen muss.
function umgebungsUrl(id: string): string | undefined {
  if (id === "n8n") return process.env.N8N_PUBLIC_URL || process.env.N8N_BASE_URL || undefined;
  if (id === "cockpit") return process.env.COCKPIT_URL || undefined;
  return undefined;
}

export async function ladeEinstellungen(): Promise<Map<string, Einstellung>> {
  await zentraleBereit();
  const rows = await q<Einstellung>(
    "SELECT app_id, url, health, coolify_url, notiz, ereignis_secret FROM zentrale_app_einstellungen",
  );
  return new Map(rows.map((r) => [r.app_id, r]));
}

export async function ladeZuordnungen(): Promise<Zuordnung[]> {
  await zentraleBereit();
  return q<Zuordnung>("SELECT repo, art, bereich, notiz FROM zentrale_repo_zuordnung ORDER BY repo");
}

function ansicht(a: AppEintrag, e: Einstellung | undefined, ausDatenbank = false): AppAnsicht {
  const url = e?.url || a.url || umgebungsUrl(a.id);
  const healthPfad = e?.health || a.health;
  return {
    ...a,
    urlAufgeloest: url,
    healthUrl: adresse(url, healthPfad),
    coolifyUrl: e?.coolify_url || undefined,
    notiz: e?.notiz || undefined,
    ereignisseEingerichtet: Boolean(e?.ereignis_secret),
    ausDatenbank,
  };
}

/** Alle Apps: Katalog + in der App aufgenommene Repositories. */
export async function ladeApps(): Promise<AppAnsicht[]> {
  const [einst, zuordnungen] = await Promise.all([ladeEinstellungen(), ladeZuordnungen()]);
  const liste = APPS.map((a) => ansicht(a, einst.get(a.id)));
  for (const z of zuordnungen) {
    if (z.art !== "intern" && z.art !== "produkt") continue;
    const id = "repo-" + z.repo.toLowerCase();
    if (liste.some((a) => a.repo === `${ORG}/${z.repo}`)) continue;
    liste.push(ansicht({
      id, name: z.repo, kurz: z.notiz || "In der App aufgenommen.",
      bereich: (z.bereich as Bereich) || "Betrieb",
      rolle: z.art === "produkt" ? "produkt" : "intern",
      repo: `${ORG}/${z.repo}`, status: "aktiv",
    }, einst.get(id), true));
  }
  return liste;
}

export async function ladeApp(id: string): Promise<AppAnsicht | null> {
  const apps = await ladeApps();
  return apps.find((a) => a.id === id) ?? null;
}

/** Adresse aus einem Formular prüfen: nur http(s), keine Zugangsdaten. */
export function pruefeAdresse(wert: string, { pfadErlaubt = false } = {}): string | null {
  const s = wert.trim();
  if (!s) return null;
  if (pfadErlaubt && s.startsWith("/")) {
    if (!/^\/[\w\-./?=&%~]*$/.test(s)) throw new Error("Ungültiger Pfad.");
    return s;
  }
  let u: URL;
  try { u = new URL(s); } catch { throw new Error(`„${s}“ ist keine gültige Adresse.`); }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && process.env.ZENTRALE_ERLAUBE_HTTP === "1")) {
    throw new Error("Nur https-Adressen sind erlaubt.");
  }
  if (u.username || u.password) throw new Error("Zugangsdaten gehören nicht in die Adresse.");
  return u.toString().replace(/\/$/, "");
}

export function istKatalogApp(id: string): boolean {
  return Boolean(findeApp(id));
}
