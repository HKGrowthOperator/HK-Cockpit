import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AktivitaetsListe } from "@/components/zentrale/aktivitaets-liste";
import { ladeLage, ladeAktivitaet, type Aktivitaet } from "@/lib/zentrale/lage";
import { letzteEreignisse } from "@/lib/zentrale/ereignisse";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTER: { wert: string; label: string }[] = [
  { wert: "", label: "Alles" },
  { wert: "ereignis", label: "Ereignisse" },
  { wert: "mail", label: "Mails" },
  { wert: "automation", label: "Automationen" },
  { wert: "commit", label: "Code" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ art?: string; quelle?: string }> }) {
  const { art = "", quelle } = await searchParams;
  const lage = await ladeLage();
  let liste: Aktivitaet[];
  if (quelle) {
    const name = lage.apps.find((a) => a.id === quelle)?.name ?? quelle;
    liste = (await letzteEreignisse(100, quelle).catch(() => [])).map((e) => ({
      zeit: e.eingang, art: "ereignis" as const, titel: e.titel, quelle: `Ereignis aus ${name}`,
    }));
  } else {
    liste = (await ladeAktivitaet(lage, 120)).filter((x) => !art || x.art === art);
  }
  return (
    <>
      <p className="text-muted-foreground mb-4 text-sm">
        Ein Strom für alles, was in den Apps passiert: eingehende Ereignisse, gesendete Mails, Automationsläufe und neuer Code.
      </p>
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-1.5">
        {FILTER.map((f) => (
          <Link key={f.wert} href={f.wert ? `/aktivitaet?art=${f.wert}` : "/aktivitaet"}
            className={cn("rounded-full border px-3 py-1 text-sm", !quelle && art === f.wert ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:border-gold")}>
            {f.label}
          </Link>
        ))}
        {quelle && <span className="bg-gold/15 border-gold/50 rounded-full border px-3 py-1 text-sm">nur {lage.apps.find((a) => a.id === quelle)?.name ?? quelle}</span>}
      </nav>
      <Card>
        <CardContent>
          <AktivitaetsListe eintraege={liste} leer="Für diesen Filter gibt es noch nichts." />
        </CardContent>
      </Card>
    </>
  );
}
