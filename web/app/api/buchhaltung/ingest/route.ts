// API: Belege von außen annehmen — aus n8n (E-Mail-Postfach) oder Google Drive.
// Geschützt über AUTOMATION_INGEST_SECRET; ohne Secret bleibt der Endpunkt in
// Produktion geschlossen, weil der Server öffentlich erreichbar ist.
import { NextResponse } from "next/server";
import { speichereBeleg, naechsteNummer } from "@/lib/accounting/db";
import { speichereDatei, pruefeDatei, erkenneAusText } from "@/lib/accounting/belege-datei";
import type { BelegQuelle, BelegTyp } from "@/lib/accounting/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECRET = process.env.AUTOMATION_INGEST_SECRET ?? "";

type Body = {
  quelle?: BelegQuelle; // "email" | "drive"
  typ?: BelegTyp;
  betreff?: string;
  absender?: string;
  text?: string; // E-Mail-Text oder ausgelesener PDF-Text
  datum?: string;
  betrag_cent?: number;
  partner?: string;
  /** Anhang als base64 (n8n: $binary.data). */
  datei?: { name?: string; mime?: string; base64?: string };
  /** Eindeutiger Schlüssel der Quelle (Message-ID, Drive-Datei-ID). */
  quelle_id?: string;
  meta?: Record<string, unknown>;
};

export async function POST(req: Request) {
  if (!SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Beleg-Eingang nicht konfiguriert (AUTOMATION_INGEST_SECRET fehlt)." },
      { status: 503 },
    );
  }
  const mitgeliefert =
    req.headers.get("x-automation-secret") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (SECRET && mitgeliefert !== SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Kein JSON erhalten." }, { status: 400 });

  const quelle: BelegQuelle = body.quelle === "drive" ? "drive" : "email";
  const typ: BelegTyp = body.typ ?? "eingangsrechnung";

  // Was nicht mitgeliefert wurde, versuchen wir aus dem Text zu lesen.
  const textQuelle = [body.betreff, body.text].filter(Boolean).join("\n");
  const erkannt = erkenneAusText(textQuelle);
  const datum = body.datum ?? erkannt.datum;
  const betrag = body.betrag_cent ?? erkannt.brutto_cent;
  const partner = body.partner ?? body.absender ?? erkannt.partner;

  const jahr = Number((datum ?? new Date().toISOString()).slice(0, 4));
  const belegnummer = await naechsteNummer("beleg", jahr);

  // Optionaler Anhang.
  let dateiName: string | null = null;
  let dateiPfad: string | null = null;
  let mime: string | null = null;
  let hash: string | null = null;

  if (body.datei?.base64) {
    const bytes = Buffer.from(body.datei.base64, "base64");
    const name = body.datei.name ?? `${belegnummer}.pdf`;
    const typDatei = body.datei.mime ?? "application/pdf";
    const fehler = pruefeDatei(name, typDatei, bytes.length);
    if (fehler) return NextResponse.json({ error: fehler }, { status: 400 });
    const gespeichert = await speichereDatei(belegnummer, name, typDatei, bytes);
    dateiName = gespeichert.name;
    dateiPfad = gespeichert.pfad;
    mime = gespeichert.mime;
    hash = gespeichert.hash;
  }

  // Doppelte Zustellung derselben E-Mail/Drive-Datei abfangen.
  const dedup = hash
    ? `${quelle}:${hash}`
    : body.quelle_id
      ? `${quelle}:${body.quelle_id}`
      : null;

  const beleg = await speichereBeleg({
    typ,
    quelle,
    status: "offen",
    datum,
    betrag_cent: betrag,
    steuer_cent: null,
    waehrung: "EUR",
    partner,
    beschreibung: body.betreff ?? null,
    datei_name: dateiName,
    datei_pfad: dateiPfad,
    mime_typ: mime,
    quelle_meta: { ...(body.meta ?? {}), absender: body.absender, quelle_id: body.quelle_id, hash },
    dedup_key: dedup,
  });

  if (!beleg) {
    return NextResponse.json({ status: "duplikat", hinweis: "Beleg war bereits vorhanden." });
  }
  return NextResponse.json(
    { status: "angelegt", beleg_id: beleg.id, belegnummer: beleg.belegnummer, erkannt },
    { status: 201 },
  );
}
