import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AktionsKnopf } from "@/components/zentrale/aktions-knopf";
import { VorlageFormular } from "@/components/zentrale/mail-verwaltung";
import { seit } from "@/components/zentrale/zeit";
import { q } from "@/lib/db";
import { zentraleBereit } from "@/lib/zentrale/schema";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { istFreigegeben, platzhalter } from "@/lib/zentrale/mail/vorlage";
import { vorlageFreigeben, vorlageLoeschen } from "@/lib/zentrale/aktionen";

export const dynamic = "force-dynamic";

type V = { id: string; name: string; zweck: string | null; betreff: string; text: string; freigabe_hash: string | null; freigegeben_von: string | null; freigegeben_am: string | null; regeln: number };

export default async function Page() {
  await zentraleBereit();
  const [vorlagen, nutzer] = await Promise.all([
    q<V>(`SELECT v.id, v.name, v.zweck, v.betreff, v.text, v.freigabe_hash, v.freigegeben_von, v.freigegeben_am::text,
                 (SELECT count(*)::int FROM mail_regeln r WHERE r.vorlage_id = v.id) AS regeln
            FROM mail_vorlagen v ORDER BY v.name`),
    aktuellerNutzer(),
  ]);
  const istGF = nutzer?.rolle === "gf";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Vorlagen</CardTitle>
          <p className="text-muted-foreground text-sm">Freigegeben heißt: die Geschäftsführung hat genau diese Fassung gelesen. Nur dann darf eine Automation sie ohne Rückfrage senden.</p>
        </CardHeader>
        <CardContent>
          {!vorlagen.length && <p className="text-muted-foreground text-sm">Noch keine Vorlage. Rechts die erste anlegen.</p>}
          <ul>
            {vorlagen.map((v) => {
              const frei = istFreigegeben(v);
              const ph = platzhalter(`${v.betreff}\n${v.text}`);
              return (
                <li key={v.id} className="border-border border-b py-3 last:border-b-0">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{v.name}</span>
                      <span className={frei ? "text-moss text-xs font-medium" : v.freigabe_hash ? "text-rust text-xs font-medium" : "text-muted-foreground text-xs"}>
                        {frei ? `freigegeben von ${v.freigegeben_von}, ${seit(v.freigegeben_am)}` : v.freigabe_hash ? "geändert, Freigabe aufgehoben" : "nicht freigegeben"}
                      </span>
                      {v.regeln > 0 && <span className="text-muted-foreground text-xs">in {v.regeln} {v.regeln === 1 ? "Automation" : "Automationen"}</span>}
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      {v.zweck && <p className="text-muted-foreground text-sm">{v.zweck}</p>}
                      {ph.length > 0 && <p className="text-muted-foreground text-xs">Platzhalter: {ph.map((p) => `{{${p}}}`).join(" ")}</p>}
                      <div className="flex flex-wrap gap-2">
                        {istGF && !frei && <AktionsKnopf aktion={vorlageFreigeben.bind(null, v.id)} variante="primaer">Diese Fassung freigeben</AktionsKnopf>}
                        <AktionsKnopf aktion={vorlageLoeschen.bind(null, v.id)} variante="gefahr" frage="Vorlage löschen?">Löschen</AktionsKnopf>
                      </div>
                      <VorlageFormular v={v} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Neue Vorlage</CardTitle></CardHeader>
        <CardContent><VorlageFormular /></CardContent>
      </Card>
    </div>
  );
}
