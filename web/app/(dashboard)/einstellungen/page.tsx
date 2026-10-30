import Link from "next/link";
import { ApiKeySettings } from "@/components/api-key-settings";
import { GoogleSettings } from "@/components/google-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubEinstellungen } from "@/components/zentrale/github-einstellungen";
import { getSecret } from "@/lib/secrets";
import { GITHUB_SECRET_KEY } from "@/lib/zentrale/github";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { ladeApps } from "@/lib/zentrale/apps";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [nutzer, gespeichert, apps, team] = await Promise.all([
    aktuellerNutzer(),
    getSecret<{ enc: string }>(GITHUB_SECRET_KEY).catch(() => null),
    ladeApps(),
    q<{ email: string; name: string | null; rolle: string }>("SELECT email, name, rolle FROM users ORDER BY rolle, email").catch(() => []),
  ]);
  const quelle = process.env.GITHUB_TOKEN ? "umgebung" : gespeichert?.enc ? "app" : "keine";
  const quellen = apps.filter((a) => a.ereignisse);
  const takt = Boolean(process.env.ZENTRALE_TAKT_SECRET || process.env.AUTOMATION_INGEST_SECRET);
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">Verbindungen und Einstellungen des Cockpits.</p>
      <div className="space-y-5">
        <Card id="github">
          <CardHeader><CardTitle className="font-serif text-lg">GitHub</CardTitle></CardHeader>
          <CardContent><GithubEinstellungen quelle={quelle} istGF={nutzer?.rolle === "gf"} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Ereignisse aus den Apps</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm">
              {quellen.map((a) => (
                <li key={a.id} className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0">
                  <span>{a.name}</span>
                  <span className={a.ereignisseEingerichtet ? "text-moss" : "text-muted-foreground"}>
                    {a.ereignisseEingerichtet ? "eingerichtet" : "nicht eingerichtet"}{" "}
                    <Link href={`/apps/${a.id}`} className="text-foreground underline">öffnen</Link>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-sm">
              Mail-Takt für verzögerte Automationen: {takt ? "geschützt eingerichtet" : "ZENTRALE_TAKT_SECRET fehlt"}.
              Aufruf alle 5 Minuten: POST /api/zentrale/takt mit Kopfzeile x-takt-secret.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Team</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm">
              {team.map((t) => (
                <li key={t.email} className="border-border flex justify-between gap-2 border-b py-2 last:border-b-0">
                  <span>{t.name || t.email}{t.name ? <span className="text-muted-foreground"> ({t.email})</span> : null}</span>
                  <span className="text-muted-foreground">{t.rolle === "gf" ? "Geschäftsführung" : "Team"}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-sm">
              Neue Personen legt die Geschäftsführung auf dem Server an:{" "}
              <code className="bg-accent rounded px-1.5 py-0.5 text-xs">node scripts/create-user.mjs &lt;email&gt; &lt;passwort&gt; --name &quot;Vorname&quot; --rolle team</code>
            </p>
          </CardContent>
        </Card>

        <ApiKeySettings />
        <GoogleSettings />
      </div>
    </>
  );
}
