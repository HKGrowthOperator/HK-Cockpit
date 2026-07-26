// API: Belege auflisten und hochladen (Datei-Upload aus dem Cockpit).
import { NextResponse } from "next/server";
import { ladeBelege, speichereBeleg, setzeBelegStatus, naechsteNummer } from "@/lib/accounting/db";
import { pruefeDatei, speichereDatei } from "@/lib/accounting/belege-datei";
import type { BelegTyp } from "@/lib/accounting/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "offen" | "gebucht" | "verworfen" | null;
  const belege = await ladeBelege(status ?? undefined);
  return NextResponse.json({ belege });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulardaten fehlen." }, { status: 400 });

  const datei = form.get("datei");
  if (!(datei instanceof File)) {
    return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 });
  }

  const fehler = pruefeDatei(datei.name, datei.type, datei.size);
  if (fehler) return NextResponse.json({ error: fehler }, { status: 400 });

  const typ = (form.get("typ") as BelegTyp) || "eingangsrechnung";
  const datum = (form.get("datum") as string) || null;
  const betrag = form.get("betrag_cent");
  const steuer = form.get("steuer_cent");
  const partner = (form.get("partner") as string) || null;
  const beschreibung = (form.get("beschreibung") as string) || null;

  const jahr = Number((datum ?? new Date().toISOString()).slice(0, 4));
  const belegnummer = await naechsteNummer("beleg", jahr);
  const bytes = Buffer.from(await datei.arrayBuffer());
  const gespeichert = await speichereDatei(belegnummer, datei.name, datei.type, bytes);

  const beleg = await speichereBeleg({
    typ,
    quelle: "upload",
    status: "offen",
    datum,
    betrag_cent: betrag ? Number(betrag) : null,
    steuer_cent: steuer ? Number(steuer) : null,
    waehrung: "EUR",
    partner,
    beschreibung,
    datei_name: gespeichert.name,
    datei_pfad: gespeichert.pfad,
    mime_typ: gespeichert.mime,
    quelle_meta: { hash: gespeichert.hash, groesse: gespeichert.groesse },
    dedup_key: `upload:${gespeichert.hash}`, // gleiche Datei nicht zweimal
  });

  if (!beleg) {
    return NextResponse.json(
      { error: "Diese Datei wurde bereits hochgeladen (gleicher Inhalt)." },
      { status: 409 },
    );
  }
  return NextResponse.json({ beleg }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id und status sind erforderlich." }, { status: 400 });
  }
  if (!["offen", "gebucht", "verworfen"].includes(body.status)) {
    return NextResponse.json({ error: "Unbekannter Status." }, { status: 400 });
  }
  await setzeBelegStatus(body.id, body.status as "offen" | "gebucht" | "verworfen");
  return NextResponse.json({ ok: true });
}
