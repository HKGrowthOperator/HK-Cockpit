// API: Buchungen lesen, anlegen und stornieren.
import { NextResponse } from "next/server";
import { ladeBuchungen, storniereBuchung, setzeBelegStatus } from "@/lib/accounting/db";
import { bucheEingabe } from "@/lib/accounting/service";
import type { BuchungEingabe } from "@/lib/accounting/buchen";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jahr = Number(url.searchParams.get("jahr")) || new Date().getFullYear();
  const konto = url.searchParams.get("konto") ?? undefined;
  const buchungen = await ladeBuchungen({ jahr, konto, limit: 1000 });
  return NextResponse.json({ buchungen });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as BuchungEingabe | null;
  if (!body) return NextResponse.json({ error: "Keine Daten erhalten." }, { status: 400 });

  try {
    const buchung = await bucheEingabe(body);
    // Ein verknüpfter Beleg gilt damit als erledigt.
    if (body.beleg_id) await setzeBelegStatus(body.beleg_id, "gebucht");
    return NextResponse.json({ buchung }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Buchung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt." }, { status: 400 });

  // GoBD: nicht löschen, sondern per Gegenbuchung stornieren.
  const storno = await storniereBuchung(id);
  if (!storno) {
    return NextResponse.json(
      { error: "Buchung nicht gefunden oder bereits storniert." },
      { status: 404 },
    );
  }
  return NextResponse.json({ storno });
}
