import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AktionsKnopf } from "@/components/zentrale/aktions-knopf";
import { KontoFormular } from "@/components/zentrale/mail-verwaltung";
import { q } from "@/lib/db";
import { zentraleBereit } from "@/lib/zentrale/schema";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { umgebungsKonto } from "@/lib/zentrale/mail/konten";
import { kontoDeaktivieren } from "@/lib/zentrale/aktionen";

export const dynamic = "force-dynamic";

type K = { id: string; name: string; absender_name: string; absender_adresse: string; antwort_an: string | null; smtp_host: string; smtp_port: number; smtp_user: string; signatur: string | null; tageslimit: number; standard: boolean; heute: number };

export default async function Page() {
  await zentraleBereit();
  const [konten, nutzer] = await Promise.all([
    q<K>(`SELECT k.id, k.name, k.absender_name, k.absender_adresse, k.antwort_an, k.smtp_host, k.smtp_port, k.smtp_user,
                 k.signatur, k.tageslimit, k.standard,
                 (SELECT count(*)::int FROM mail_ausgang a WHERE a.konto_id = k.id AND a.status = 'gesendet'
                     AND a.gesendet_am >= date_trunc('day', now())) AS heute
            FROM mail_konten k WHERE k.aktiv ORDER BY k.standard DESC, k.created_at`),
    aktuellerNutzer(),
  ]);
  const env = umgebungsKonto();
  const istGF = nutzer?.rolle === "gf";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Postfächer</CardTitle>
          <p className="text-muted-foreground text-sm">Über diese Postfächer gehen die Mails der Zentrale raus. Passwörter liegen verschlüsselt in der Datenbank.</p>
        </CardHeader>
        <CardContent>
          {!konten.length && (
            <p className="text-muted-foreground mb-3 text-sm">
              {env ? `Noch kein Postfach in der App. Bis dahin sendet das Cockpit über ${env.absender_adresse} aus der Umgebung.` : "Noch kein Postfach eingerichtet."}
            </p>
          )}
          <ul>
            {konten.map((k) => (
              <li key={k.id} className="border-border border-b py-3 last:border-b-0">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3">
                    <span className="font-medium">{k.absender_name} &lt;{k.absender_adresse}&gt;</span>
                    {k.standard && <span className="text-gold-ink text-xs font-medium">Standard</span>}
                    <span className="text-muted-foreground text-xs">heute {k.heute} von {k.tageslimit}</span>
                  </summary>
                  {istGF && (
                    <div className="mt-3 flex flex-col gap-3">
                      <KontoFormular k={k} />
                      <div><AktionsKnopf aktion={kontoDeaktivieren.bind(null, k.id)} variante="gefahr" frage="Postfach entfernen?">Postfach entfernen</AktionsKnopf></div>
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Postfach hinzufügen</CardTitle></CardHeader>
        <CardContent>
          {istGF ? <KontoFormular /> : <p className="text-muted-foreground text-sm">Postfächer richtet die Geschäftsführung ein.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
