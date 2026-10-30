import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppZeile } from "@/components/zentrale/app-zeile";
import { RepoEinordnen } from "@/components/zentrale/repo-einordnen";
import { seit } from "@/components/zentrale/zeit";
import { ladeLage, type AppLage } from "@/lib/zentrale/lage";
import { ladeZuordnungen } from "@/lib/zentrale/apps";
import { orgRepos } from "@/lib/zentrale/github";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { ABGELEGT, KUNDEN_REPOS, UNENTSCHIEDEN, repoName } from "@/lib/zentrale/register";
import { WERKZEUGE, WERKZEUG_GRUPPEN } from "@/lib/zentrale/werkzeuge";

export const dynamic = "force-dynamic";

const ABSCHNITTE: { titel: string; text: string; passt: (a: AppLage) => boolean }[] = [
  { titel: "Unsere Werkzeuge", text: "Was HK für sich selbst baut und täglich nutzt.", passt: (a) => a.rolle === "zentrale" || a.rolle === "intern" },
  { titel: "Eigene Produkte", text: "Marken und Produkte, die HK selbst betreibt oder verkauft.", passt: (a) => a.rolle === "produkt" },
  { titel: "Eigenständig", text: "Laufen bewusst getrennt. Das Cockpit verlinkt sie und liest ihren Status, schreibt aber nie hinein.", passt: (a) => a.rolle === "eigenstaendig" },
  { titel: "Infrastruktur", text: "Worauf alles läuft.", passt: (a) => a.rolle === "infrastruktur" },
];

export default async function Page() {
  const [lage, nutzer, org, zuordnungen] = await Promise.all([
    ladeLage(),
    aktuellerNutzer().catch(() => null),
    orgRepos().catch(() => ({ verbunden: false, repos: [], fehler: undefined })),
    ladeZuordnungen().catch(() => []),
  ]);

  const bekannt = new Set<string>([
    ...lage.apps.map((a) => repoName(a.repo)).filter((r): r is string => Boolean(r)),
    ...WERKZEUGE.map((w) => w.repo),
    ...KUNDEN_REPOS,
    ...Object.keys(ABGELEGT),
    ...zuordnungen.map((z) => z.repo),
  ]);
  const offen = org.repos.filter((r) => !r.fork && !bekannt.has(r.name));
  const kunden = new Set([...KUNDEN_REPOS, ...zuordnungen.filter((z) => z.art === "kunde").map((z) => z.repo)]);

  return (
    <>
      {lage.githubFehler && (
        <p className="border-rust/40 bg-rust/8 text-rust mb-5 rounded-md border px-3 py-2 text-sm">
          GitHub: {lage.githubFehler}. Code-Stand und Pull Requests fehlen, bis die <Link href="/einstellungen#github" className="underline">Verbindung</Link> wieder steht.
        </p>
      )}
      <p className="text-muted-foreground mb-6 max-w-3xl text-sm">
        Alle Apps und Repositories, die HK für sich selbst gebaut hat, mit Status, Code-Stand und dem direkten Weg hinein.
        Kundenprojekte sind bewusst nicht dabei.
      </p>

      {ABSCHNITTE.map((abschnitt) => {
        const liste = lage.apps.filter(abschnitt.passt);
        if (!liste.length) return null;
        return (
          <Card key={abschnitt.titel} className="mb-5">
            <CardHeader>
              <CardTitle className="font-serif text-lg">{abschnitt.titel}</CardTitle>
              <p className="text-muted-foreground text-sm">{abschnitt.text}</p>
            </CardHeader>
            <CardContent>
              <ul>{liste.map((a) => <AppZeile key={a.id} a={a} github={lage.githubVerbunden} githubFehler={lage.githubFehler} />)}</ul>
            </CardContent>
          </Card>
        );
      })}

      {org.verbunden && (offen.length > 0 || org.fehler) && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Noch einzuordnen</CardTitle>
            <p className="text-muted-foreground text-sm">
              Diese Repositories liegen in der GitHub-Organisation, sind aber weder als eigene App noch als Kundenprojekt erfasst.
              {nutzer?.rolle !== "gf" && " Die Geschäftsführung ordnet sie ein."}
            </p>
          </CardHeader>
          <CardContent>
            {org.fehler && <p className="text-rust text-sm">GitHub: {org.fehler}</p>}
            <ul>
              {offen.map((r) => (
                <li key={r.name} className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0">
                  <div className="min-w-48 flex-1">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{r.name}</a>
                    <p className="text-muted-foreground text-xs">
                      {r.privat ? "privat" : "öffentlich"}, zuletzt {seit(r.gepusht)}
                      {UNENTSCHIEDEN.includes(r.name) ? ", bekannt, aber offen" : ", neu"}
                    </p>
                  </div>
                  {nutzer?.rolle === "gf" && <RepoEinordnen repo={r.name} />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Werkzeugkasten</CardTitle>
          <p className="text-muted-foreground text-sm">Geforkte Open-Source-Werkzeuge, mit denen HK arbeitet. Gepflegt werden sie im Original.</p>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WERKZEUG_GRUPPEN.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-sm font-semibold">{g}</h3>
              <ul className="flex flex-col gap-1">
                {WERKZEUGE.filter((w) => w.gruppe === g).map((w) => (
                  <li key={w.repo}>
                    <a href={`https://github.com/HKGrowthOperator/${w.repo}`} target="_blank" rel="noopener noreferrer" className="hover:bg-accent -mx-2 flex flex-col rounded-md px-2 py-1">
                      <span className="text-sm font-medium">{w.repo}</span>
                      <span className="text-muted-foreground text-xs">{w.kurz}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <details className="text-muted-foreground text-sm">
        <summary className="cursor-pointer">{kunden.size} Kundenrepositories und {Object.keys(ABGELEGT).length} abgelegte Repositories sind ausgeblendet</summary>
        <p className="mt-2">Kunden: {[...kunden].sort().join(", ")}.</p>
        <ul className="mt-1">{Object.entries(ABGELEGT).map(([r, g]) => <li key={r}>{r}: {g}</li>)}</ul>
        {!lage.githubVerbunden && (
          <p className="mt-2">Mit <Link href="/einstellungen#github" className="underline">GitHub-Verbindung</Link> erkennt das Cockpit neue Repositories von selbst.</p>
        )}
      </details>
    </>
  );
}
