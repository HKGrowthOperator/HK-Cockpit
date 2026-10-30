import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPunkt } from "@/components/zentrale/status-punkt";
import { AktionsKnopf } from "@/components/zentrale/aktions-knopf";
import { AppEinstellungen } from "@/components/zentrale/app-einstellungen";
import { CiMarke } from "@/components/zentrale/app-zeile";
import { knopfKlasse } from "@/components/zentrale/stil";
import { seit, datumZeit } from "@/components/zentrale/zeit";
import { ladeApp, ladeEinstellungen } from "@/lib/zentrale/apps";
import { pruefe } from "@/lib/zentrale/health";
import { ZUSTAND_TEXT } from "@/lib/zentrale/health-text";
import { repoStaende } from "@/lib/zentrale/github";
import { letzteEreignisse } from "@/lib/zentrale/ereignisse";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { ROLLEN_TEXT, adresse } from "@/lib/zentrale/register";
import { ereignisGeheimnisErzeugen, healthNeuPruefen } from "@/lib/zentrale/aktionen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await ladeApp(id);
  if (!app) notFound();

  const [pruefung, gh, ereignisse, nutzer, einst] = await Promise.all([
    app.rolle === "zentrale" ? Promise.resolve(null) : pruefe(app.healthUrl ?? app.urlAufgeloest),
    app.repo ? repoStaende([app.repo]).catch(() => ({ verbunden: false, liste: [] })) : Promise.resolve(null),
    app.ereignisse ? letzteEreignisse(10, app.id).catch(() => []) : Promise.resolve([]),
    aktuellerNutzer().catch(() => null),
    ladeEinstellungen().catch(() => new Map()),
  ]);
  const stand = gh?.liste[0]?.stand;
  const standFehler = gh?.liste[0]?.fehler;
  const e = einst.get(app.id);
  const istGF = nutzer?.rolle === "gf";
  const basis = process.env.COCKPIT_URL?.replace(/\/$/, "");
  const eingang = `${basis ?? "<Cockpit-Adresse>"}/api/ereignisse/${app.id}`;

  return (
    <>
      <Link href="/apps" className="text-muted-foreground hover:text-foreground mb-4 inline-block text-sm">Alle Apps</Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <StatusPunkt zustand={pruefung?.zustand ?? "ok"} groesse="md" />
            <h2 className="font-serif text-3xl font-semibold">{app.name}</h2>
          </div>
          <p className="text-muted-foreground mt-2">{app.kurz}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {ROLLEN_TEXT[app.rolle]} im Bereich {app.bereich}
            {pruefung && <>. Status: {ZUSTAND_TEXT[pruefung.zustand]}{pruefung.code ? ` (HTTP ${pruefung.code}, ${pruefung.ms} ms)` : ""}{pruefung.meldung ? `, ${pruefung.meldung}` : ""}</>}
          </p>
          {app.hinweis && <p className="border-gold/50 bg-gold/10 mt-3 rounded-md border px-3 py-2 text-sm">{app.hinweis}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {app.urlAufgeloest && <a href={app.urlAufgeloest} target="_blank" rel="noopener noreferrer" className={knopfKlasse("primaer")}>App öffnen</a>}
          {app.repo && <a href={`https://github.com/${app.repo}`} target="_blank" rel="noopener noreferrer" className={knopfKlasse("zweit")}>Repository</a>}
          {app.coolifyUrl && <a href={app.coolifyUrl} target="_blank" rel="noopener noreferrer" className={knopfKlasse("zweit")}>In Coolify</a>}
          {app.rolle !== "zentrale" && <AktionsKnopf aktion={healthNeuPruefen.bind(null, app.id)} variante="leise">Status prüfen</AktionsKnopf>}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div className="flex flex-col gap-5">
          {(app.bedienung?.length || app.extern?.length) ? (
            <Card>
              <CardHeader><CardTitle className="font-serif text-lg">Bedienen</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {app.bedienung?.map((b) => {
                    const ziel = adresse(app.urlAufgeloest, b.pfad);
                    return (
                      <li key={b.label}>
                        {ziel ? (
                          <a href={ziel} target="_blank" rel="noopener noreferrer" className="border-border hover:border-gold flex flex-col rounded-lg border px-3 py-2.5">
                            <span className="font-medium">{b.label}</span>
                            <span className="text-muted-foreground text-xs">{b.hinweis ?? ziel.replace(/^https:\/\//, "")}</span>
                          </a>
                        ) : (
                          <span className="border-border text-muted-foreground flex flex-col rounded-lg border border-dashed px-3 py-2.5">
                            <span className="font-medium">{b.label}</span>
                            <span className="text-xs">erst mit eingetragener Adresse</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {app.extern?.map((x) => (
                    <li key={x.url}>
                      <a href={x.url} target="_blank" rel="noopener noreferrer" className="border-border hover:border-gold flex flex-col rounded-lg border px-3 py-2.5">
                        <span className="font-medium">{x.label}</span>
                        <span className="text-muted-foreground text-xs">{new URL(x.url).host}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {app.repo && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="font-serif text-lg">Code</CardTitle>
                {stand?.ci && <a href={stand.ci.url} target="_blank" rel="noopener noreferrer"><CiMarke ergebnis={stand.ci.ergebnis} zustand={stand.ci.zustand} /></a>}
              </CardHeader>
              <CardContent>
                {!gh?.verbunden ? (
                  <p className="text-muted-foreground text-sm">GitHub ist nicht verbunden. <Link href="/einstellungen#github" className="underline">Jetzt verbinden</Link>, dann stehen hier Commits, Pull Requests und CI.</p>
                ) : standFehler ? (
                  <p className="text-rust text-sm">{standFehler}</p>
                ) : stand ? (
                  <>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Zweig {stand.standardZweig}, zuletzt gepusht {seit(stand.zuletztGepusht)}, {stand.offeneIssues} offene Issues.
                    </p>
                    {stand.pullRequests.length > 0 && (
                      <>
                        <h3 className="mb-1 text-sm font-semibold">Offene Pull Requests</h3>
                        <ul className="mb-4">
                          {stand.pullRequests.map((p) => (
                            <li key={p.nummer}>
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:bg-accent -mx-2 flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm">
                                <span className="text-muted-foreground tabular-nums">#{p.nummer}</span>
                                <span className="flex-1 truncate">{p.titel}{p.entwurf ? " (Entwurf)" : ""}</span>
                                <span className="text-muted-foreground text-xs">{p.autor}, {seit(p.zeit)}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <h3 className="mb-1 text-sm font-semibold">Letzte Commits</h3>
                    <ul>
                      {stand.commits.map((c) => (
                        <li key={c.sha}>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:bg-accent -mx-2 flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm">
                            <span className="flex-1 truncate">{c.nachricht}</span>
                            <span className="text-muted-foreground shrink-0 text-xs">{c.autor}, {seit(c.zeit)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}

          {app.ereignisse && (
            <Card>
              <CardHeader><CardTitle className="font-serif text-lg">Ereignisse ans Cockpit</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p>
                  {app.name.split(" · ")[0]} kann melden, was passiert ({app.ereignisse.arten.join(", ")}).
                  Das Cockpit zeigt es im Aktivitätsstrom und kann daraus Mails vorbereiten.
                </p>
                <p className="text-muted-foreground">{app.ereignisse.einrichtung}</p>
                <dl className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Adresse</dt>
                  <dd><code className="bg-accent rounded px-2 py-1 text-xs break-all select-all">{eingang}</code></dd>
                  <dt className="text-muted-foreground mt-2 text-xs">Geheimnis</dt>
                  <dd>{e?.ereignis_secret ? "eingerichtet (wird aus Sicherheitsgründen nicht erneut angezeigt)" : "noch keins"}</dd>
                </dl>
                {istGF ? (
                  <AktionsKnopf aktion={ereignisGeheimnisErzeugen.bind(null, app.id)} zeigeWert
                    frage={e?.ereignis_secret ? "Ein neues Geheimnis ersetzt das alte. Die App muss danach umgestellt werden. Fortfahren?" : undefined}>
                    {e?.ereignis_secret ? "Neues Geheimnis erzeugen" : "Geheimnis erzeugen"}
                  </AktionsKnopf>
                ) : <p className="text-muted-foreground text-xs">Das Geheimnis erzeugt die Geschäftsführung.</p>}
                {ereignisse.length > 0 && (
                  <>
                    <h3 className="mt-2 font-semibold">Zuletzt empfangen</h3>
                    <ul>
                      {ereignisse.map((x) => (
                        <li key={x.id} className="flex items-baseline gap-2 py-1">
                          <span className="flex-1 truncate">{x.titel}</span>
                          <span className="text-muted-foreground text-xs" title={datumZeit(x.eingang)}>{seit(x.eingang)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">Adressen und Notiz</CardTitle></CardHeader>
            <CardContent>
              <AppEinstellungen
                appId={app.id}
                werte={{ url: e?.url ?? "", health: e?.health ?? "", coolify_url: e?.coolify_url ?? "", notiz: e?.notiz ?? "" }}
                vorgabe={{ url: app.url ?? (app.id === "n8n" ? "aus N8N_PUBLIC_URL" : ""), health: app.health ?? "" }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">Steckbrief</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                {app.repo && <><dt className="text-muted-foreground">Repository</dt><dd>{app.repo}</dd></>}
                {app.stack && <><dt className="text-muted-foreground">Technik</dt><dd>{app.stack}</dd></>}
                {app.betrieb && <><dt className="text-muted-foreground">Betrieb</dt><dd>{app.betrieb}</dd></>}
                {app.healthUrl && <><dt className="text-muted-foreground">Prüfadresse</dt><dd className="break-all">{app.healthUrl}</dd></>}
                {app.notiz && <><dt className="text-muted-foreground">Notiz</dt><dd className="whitespace-pre-line">{app.notiz}</dd></>}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
