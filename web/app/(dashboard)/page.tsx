import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";
import { Baum } from "@/components/zentrale/baum";
import { AktivitaetsListe } from "@/components/zentrale/aktivitaets-liste";
import { getKpis, type Kpis } from "@/lib/queries";
import { listItems } from "@/lib/store";
import { q } from "@/lib/db";
import { ladeLage, ladeAktivitaet } from "@/lib/zentrale/lage";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import type { Zustand } from "@/lib/zentrale/health";

// Immer frisch rendern (Live-Übersicht).
export const dynamic = "force-dynamic";

const BETRIEB: { key: string; label: string; href: string }[] = [
  { key: "clients", label: "Kunden", href: "/kundenbedienung" },
  { key: "invoices", label: "Rechnungen", href: "/rechnungen" },
  { key: "sops", label: "SOPs", href: "/sops" },
  { key: "concepts", label: "Konzepte", href: "/konzepte" },
  { key: "automations", label: "Automationen", href: "/automation" },
  { key: "websites", label: "Webseiten", href: "/webseiten" },
];

function gruss(): string {
  const h = Number(new Date().toLocaleString("de-DE", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" }));
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

type Punkt = { text: string; href: string; ton: "bad" | "warn" | "info" };

export default async function Page() {
  const [lage, nutzer, kpis, zaehler, ereignisseHeute] = await Promise.all([
    ladeLage(),
    aktuellerNutzer().catch(() => null),
    getKpis().catch((): Kpis | null => null),
    Promise.all(BETRIEB.map((b) => listItems(b.key).then((r) => r.length).catch(() => 0))),
    q<{ n: number }>("SELECT count(*)::int AS n FROM ereignisse WHERE eingang >= date_trunc('day', now())")
      .then((r) => r[0]?.n ?? 0).catch(() => 0),
  ]);
  const aktivitaet = await ladeAktivitaet(lage, 14);
  const b = lage.braucht;

  const punkte: Punkt[] = [];
  if (b.mailsZurFreigabe) punkte.push({ text: `${b.mailsZurFreigabe} ${b.mailsZurFreigabe === 1 ? "Mail wartet" : "Mails warten"} auf Freigabe`, href: "/mail", ton: "warn" });
  if (b.mailFehler) punkte.push({ text: `${b.mailFehler} ${b.mailFehler === 1 ? "Mail wurde" : "Mails wurden"} nicht gesendet`, href: "/mail", ton: "bad" });
  for (const a of lage.apps.filter((x) => x.pruefung.zustand === "gestoert" || x.pruefung.zustand === "nicht-erreichbar")) {
    punkte.push({ text: `${a.name.split(" · ")[0]} ist ${a.pruefung.zustand === "gestoert" ? "gestört" : "nicht erreichbar"}`, href: `/apps/${a.id}`, ton: "bad" });
  }
  if (b.automationsFehler) punkte.push({ text: `${b.automationsFehler} Automationsfehler in 7 Tagen`, href: "/automation", ton: "bad" });
  if (b.offenePRs) punkte.push({ text: `${b.offenePRs} offene Pull Requests`, href: "/apps", ton: "info" });
  if (lage.githubFehler) punkte.push({ text: `GitHub: ${lage.githubFehler}. Verbindung prüfen`, href: "/einstellungen#github", ton: "bad" });
  if (!lage.githubVerbunden) punkte.push({ text: "GitHub verbinden, damit Code-Stand und Pull Requests erscheinen", href: "/einstellungen#github", ton: "info" });
  if (!lage.postfachEingerichtet) punkte.push({ text: "Postfach für den Mail-Versand einrichten", href: "/mail/konten", ton: "info" });

  const zustand = (z: boolean | undefined): Zustand => (z ? "ok" : "unbekannt");
  const infra = (id: string) => lage.apps.find((a) => a.id === id);
  const wurzeln = [
    {
      label: "GitHub",
      zustand: lage.githubFehler ? "gestoert" as const : zustand(lage.githubVerbunden),
      text: lage.githubFehler ? "Verbindung gestört" : lage.githubVerbunden ? `${lage.apps.filter((a) => a.stand).length} Repos gelesen` : "nicht verbunden",
      href: "/einstellungen#github",
    },
    { label: "n8n", zustand: infra("n8n")?.pruefung.zustand ?? "unbekannt", text: lage.n8nEingerichtet ? "führt Automationen aus" : "nicht verbunden", href: "/automation" },
    { label: "Postfach", zustand: zustand(lage.postfachEingerichtet), text: lage.postfachEingerichtet ? "Versand bereit" : "nicht eingerichtet", href: "/mail/konten" },
    { label: "Coolify", zustand: infra("coolify")?.pruefung.zustand ?? "unbekannt", text: "hier laufen die Apps", href: "/apps/coolify" },
    { label: "Backups", zustand: infra("backup-server")?.pruefung.zustand ?? "unbekannt", text: "Sicherungen", href: "/apps/backup-server" },
  ];
  const stamm = [
    { label: "Mails offen", wert: String(b.mailsZurFreigabe + b.mailFehler), href: "/mail" },
    { label: "Ereignisse heute", wert: String(ereignisseHeute), href: "/aktivitaet" },
    { label: "Automationen heute", wert: String(kpis?.runs_today ?? 0), href: "/automation" },
  ];
  const datum = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const laufend = lage.apps.filter((a) => a.pruefung.zustand === "ok" || a.pruefung.zustand === "langsam").length;
  const geprueft = lage.apps.filter((a) => a.pruefung.zustand !== "unbekannt").length;

  return (
    <>
      <AutoRefresh seconds={60} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold">{gruss()}{nutzer ? `, ${nutzer.name}` : ""}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{datum}. {laufend} von {geprueft} geprüften Apps laufen.</p>
        </div>
      </div>

      <section aria-label="Braucht dich" className="mb-8">
        {punkte.length ? (
          <ul className="flex flex-wrap gap-2">
            {punkte.map((p) => (
              <li key={p.text}>
                <Link href={p.href} className={
                  p.ton === "bad" ? "border-rust/40 bg-rust/8 text-rust hover:bg-rust/12 inline-flex rounded-lg border px-3 py-2 text-sm font-medium"
                  : p.ton === "warn" ? "border-gold/50 bg-gold/10 text-gold-ink hover:bg-gold/15 inline-flex rounded-lg border px-3 py-2 text-sm font-medium"
                  : "border-border bg-card hover:border-gold inline-flex rounded-lg border px-3 py-2 text-sm"
                }>{p.text}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-moss text-sm font-medium">Alles ruhig. Nichts wartet auf dich.</p>
        )}
      </section>

      <Baum apps={lage.apps} stamm={stamm} wurzeln={wurzeln} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Was gerade passiert</CardTitle>
            <Link href="/aktivitaet" className="text-muted-foreground hover:text-foreground text-sm">Alles ansehen</Link>
          </CardHeader>
          <CardContent>
            <AktivitaetsListe eintraege={aktivitaet} leer={
              <>Noch keine Aktivität. Sobald Apps Ereignisse senden, Automationen laufen oder GitHub verbunden ist, erscheint hier der gemeinsame Strom.</>
            } />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Automationen</CardTitle>
              <Link href="/automation" className="text-muted-foreground hover:text-foreground text-sm">Starten</Link>
            </CardHeader>
            <CardContent>
              {kpis ? (
                <dl className="grid grid-cols-2 gap-4">
                  <div><dt className="text-muted-foreground text-xs">Läufe heute</dt><dd className="text-2xl font-semibold tabular-nums">{kpis.runs_today}</dd></div>
                  <div><dt className="text-muted-foreground text-xs">Erfolgsquote 7 Tage</dt><dd className="text-2xl font-semibold tabular-nums">{kpis.success_rate_pct != null ? `${kpis.success_rate_pct} %` : "–"}</dd></div>
                  <div><dt className="text-muted-foreground text-xs">Kosten im Monat</dt><dd className="text-2xl font-semibold tabular-nums">{Number(kpis.cost_eur_month).toFixed(2)} €</dd></div>
                  <div><dt className="text-muted-foreground text-xs">Fehler 7 Tage</dt><dd className={`text-2xl font-semibold tabular-nums ${Number(kpis.open_errors) > 0 ? "text-rust" : ""}`}>{kpis.open_errors}</dd></div>
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">Noch keine Lauf-Daten. Sobald n8n Läufe meldet, stehen hier die Kennzahlen.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">Betrieb</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid grid-cols-3 gap-2">
                {BETRIEB.map((x, i) => (
                  <li key={x.key}>
                    <Link href={x.href} className="hover:bg-accent flex flex-col rounded-md px-2 py-1.5">
                      <span className="text-xl font-semibold tabular-nums">{zaehler[i]}</span>
                      <span className="text-muted-foreground text-xs">{x.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
