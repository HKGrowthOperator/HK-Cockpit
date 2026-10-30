import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AktionsKnopf } from "@/components/zentrale/aktions-knopf";
import { knopfKlasse } from "@/components/zentrale/stil";
import { seit, datumZeit } from "@/components/zentrale/zeit";
import { ladeAusgang, type AusgangZeile } from "@/lib/zentrale/mail/ausgang";
import { ladeKonten } from "@/lib/zentrale/mail/konten";
import { ausgangJetztSenden, mailFreigeben, mailVerwerfen } from "@/lib/zentrale/aktionen";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<AusgangZeile["status"], string> = {
  entwurf: "Entwurf", wartet: "wartet auf Freigabe", freigegeben: "freigegeben", sendet: "wird gesendet",
  gesendet: "gesendet", fehler: "nicht gesendet", verworfen: "verworfen",
};

function Mail({ m }: { m: AusgangZeile }) {
  const offen = ["entwurf", "wartet", "fehler"].includes(m.status);
  const geplant = m.status === "freigegeben" && m.geplant;
  return (
    <li className="border-border border-b py-4 last:border-b-0">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
            m.status === "fehler" ? "bg-rust/12 text-rust" : m.status === "wartet" ? "bg-gold/15 text-gold-ink"
            : m.status === "gesendet" ? "bg-moss/15 text-moss" : "bg-accent text-muted-foreground")}>
            {geplant ? `geplant ${seit(m.faellig_am)}` : STATUS_TEXT[m.status]}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{m.betreff}</span>
          <span className="text-muted-foreground text-sm">an {m.an}</span>
          <span className="text-muted-foreground text-xs" title={datumZeit(m.created_at)}>{seit(m.gesendet_am ?? m.created_at)}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3 pl-1">
          <p className="text-muted-foreground text-xs">
            {m.regel_name ? `Aus der Automation „${m.regel_name}“` : m.herkunft === "rechnung" ? "Aus den Rechnungen" : `Von ${m.erstellt_von ?? "Hand"}`}
            {m.ereignis_titel ? `, ausgelöst durch: ${m.ereignis_titel}` : ""}
            {m.konto_name ? `. Postfach: ${m.konto_name}` : ""}
            {m.freigegeben_von ? `. Freigegeben von ${m.freigegeben_von}` : ""}
          </p>
          {m.fehler && <p className={cn("rounded-md px-3 py-2 text-sm", m.status === "fehler" ? "bg-rust/10 text-rust" : "bg-gold/10")}>{m.fehler}</p>}
          <pre className="bg-card border-border max-w-3xl rounded-md border p-3 font-sans text-sm whitespace-pre-wrap">{m.text}</pre>
          {(offen || m.status === "freigegeben") && (
            <div className="flex flex-wrap gap-2">
              {offen && <AktionsKnopf aktion={mailFreigeben.bind(null, m.id)} variante="primaer">{m.status === "fehler" ? "Erneut senden" : "Freigeben und senden"}</AktionsKnopf>}
              {offen && <Link href={`/mail/neu?id=${m.id}`} className={knopfKlasse("zweit")}>Bearbeiten</Link>}
              <AktionsKnopf aktion={mailVerwerfen.bind(null, m.id)} variante="gefahr" frage="Diese Mail verwerfen?">Verwerfen</AktionsKnopf>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const { ansicht } = await searchParams;
  const gesendet = ansicht === "gesendet";
  const [mails, konten] = await Promise.all([ladeAusgang(gesendet ? "gesendet" : "offen"), ladeKonten().catch(() => [])]);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Hier landet jede Mail, bevor sie das Haus verlässt. Du siehst genau, was rausgeht, und gibst es frei.
          Automatisch gehen nur Mails raus, die eine freigegebene Automation erzeugt hat.
        </p>
        <div className="flex gap-2">
          <Link href={gesendet ? "/mail" : "/mail?ansicht=gesendet"} className={knopfKlasse("leise")}>{gesendet ? "Offene zeigen" : "Gesendete zeigen"}</Link>
          {!gesendet && <AktionsKnopf aktion={ausgangJetztSenden} variante="zweit">Fällige jetzt senden</AktionsKnopf>}
          <Link href="/mail/neu" className={knopfKlasse("primaer")}>Neue Mail</Link>
        </div>
      </div>
      {!konten.length && (
        <p className="border-gold/50 bg-gold/10 mb-5 rounded-md border px-3 py-2 text-sm">
          Noch kein Postfach für den Versand. <Link href="/mail/konten" className="underline">Postfach einrichten</Link>
        </p>
      )}
      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">{gesendet ? "Gesendet und verworfen" : "Offen"}</CardTitle></CardHeader>
        <CardContent>
          {mails.length ? <ul>{mails.map((m) => <Mail key={m.id} m={m} />)}</ul> : (
            <p className="text-muted-foreground py-6 text-sm">
              {gesendet ? "Noch nichts gesendet." : "Nichts wartet. Neue Mails entstehen von Hand, aus Rechnungen oder aus Automationen."}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
