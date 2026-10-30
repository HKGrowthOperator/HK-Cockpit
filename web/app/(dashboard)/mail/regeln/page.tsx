import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AktionsKnopf } from "@/components/zentrale/aktions-knopf";
import { RegelFormular } from "@/components/zentrale/mail-verwaltung";
import { q } from "@/lib/db";
import { zentraleBereit } from "@/lib/zentrale/schema";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { ladeApps } from "@/lib/zentrale/apps";
import { ladeKonten } from "@/lib/zentrale/mail/konten";
import { istFreigegeben } from "@/lib/zentrale/mail/vorlage";
import { regelLoeschen, regelUmschalten } from "@/lib/zentrale/aktionen";

export const dynamic = "force-dynamic";

type R = {
  id: string; name: string; app_id: string; art: string; vorlage_id: string; konto_id: string | null;
  empfaenger: string; modus: string; verzoegerung_min: number; aktiv: boolean;
  v_name: string; v_betreff: string; v_text: string; v_hash: string | null; erzeugt: number;
};

function dauer(min: number): string {
  if (!min) return "sofort";
  if (min % 1440 === 0) return `nach ${min / 1440} ${min === 1440 ? "Tag" : "Tagen"}`;
  if (min % 60 === 0) return `nach ${min / 60} Std.`;
  return `nach ${min} Min.`;
}

export default async function Page() {
  await zentraleBereit();
  const [regeln, vorlagen, konten, apps, nutzer] = await Promise.all([
    q<R>(`SELECT r.id, r.name, r.app_id, r.art, r.vorlage_id, r.konto_id, r.empfaenger, r.modus, r.verzoegerung_min, r.aktiv,
                 v.name AS v_name, v.betreff AS v_betreff, v.text AS v_text, v.freigabe_hash AS v_hash,
                 (SELECT count(*)::int FROM mail_ausgang a WHERE a.regel_id = r.id) AS erzeugt
            FROM mail_regeln r JOIN mail_vorlagen v ON v.id = r.vorlage_id ORDER BY r.created_at`),
    q<{ id: string; name: string }>("SELECT id, name FROM mail_vorlagen ORDER BY name"),
    ladeKonten(),
    ladeApps(),
    aktuellerNutzer(),
  ]);
  // Eigene Apps zuerst; Ereignisse aus eigenständigen Apps taugen nur für interne Hinweise.
  const quellen = apps
    .filter((a) => a.ereignisse)
    .sort((a, b) => Number(a.rolle === "eigenstaendig") - Number(b.rolle === "eigenstaendig"))
    .map((a) => ({ id: a.id, name: a.name, arten: a.ereignisse!.arten, felder: a.ereignisse!.felder, bereit: a.ereignisseEingerichtet }));
  const name = new Map(apps.map((a) => [a.id, a.name]));
  const istGF = nutzer?.rolle === "gf";
  const vorlagenWahl = vorlagen.map((v) => ({ id: v.id, text: v.name }));
  const kontenWahl = konten.filter((k) => k.id).map((k) => ({ id: k.id!, text: `${k.absender_name} <${k.absender_adresse}>` }));
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Mail-Automationen</CardTitle>
            <p className="text-muted-foreground text-sm">
              Wenn in einer App etwas passiert, legt das Cockpit eine Mail an. Zum Beispiel: Auf jede Website-Anfrage
              zwei Tage später nachfassen. Ereignisse aus Sales App und Coldmail gehen nur an interne Adressen, denn nach außen schreiben diese Apps selbst.
            </p>
          </CardHeader>
          <CardContent>
            {quellen.filter((x) => !x.bereit).map((x) => (
              <p key={x.id} className="border-gold/50 bg-gold/10 mb-3 rounded-md border px-3 py-2 text-sm">
                {x.name} sendet noch keine Ereignisse. <Link href={`/apps/${x.id}`} className="underline">Einrichten</Link>
              </p>
            ))}
            {!regeln.length && <p className="text-muted-foreground text-sm">Noch keine Automation.</p>}
            <ul>
              {regeln.map((r) => {
                const frei = istFreigegeben({ betreff: r.v_betreff, text: r.v_text, freigabe_hash: r.v_hash });
                return (
                  <li key={r.id} className="border-border border-b py-3 last:border-b-0">
                    <details>
                      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className={r.aktiv ? "font-medium" : "text-muted-foreground font-medium line-through"}>{r.name}</span>
                        <span className={r.modus === "automatisch" ? (frei ? "text-moss text-xs font-medium" : "text-rust text-xs font-medium") : "text-muted-foreground text-xs"}>
                          {r.modus === "automatisch" ? (frei ? "sendet automatisch" : "automatisch, aber Vorlage nicht freigegeben") : "zur Freigabe"}
                        </span>
                      </summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <p className="text-sm">
                          Wenn in {name.get(r.app_id) ?? r.app_id} „{r.art === "*" ? "irgendetwas" : r.art}“ passiert, {dauer(r.verzoegerung_min)} „{r.v_name}“ an {r.empfaenger}. Bisher {r.erzeugt} {r.erzeugt === 1 ? "Mail" : "Mails"}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <AktionsKnopf aktion={regelUmschalten.bind(null, r.id, !r.aktiv)}>{r.aktiv ? "Pausieren" : "Wieder aktivieren"}</AktionsKnopf>
                          <AktionsKnopf aktion={regelLoeschen.bind(null, r.id)} variante="gefahr" frage="Automation löschen? Bereits erzeugte Mails bleiben.">Löschen</AktionsKnopf>
                        </div>
                        <RegelFormular apps={quellen} vorlagen={vorlagenWahl} konten={kontenWahl} istGF={istGF} r={r} />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Neue Automation</CardTitle></CardHeader>
        <CardContent><RegelFormular apps={quellen} vorlagen={vorlagenWahl} konten={kontenWahl} istGF={istGF} /></CardContent>
      </Card>
    </div>
  );
}
