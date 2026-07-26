// API: Kontoauszug (CSV) einlesen und Zahlungen offenen Rechnungen zuordnen.
import { NextResponse } from "next/server";
import { importiereBankUmsaetze, ladeBankUmsaetze, setzeBankStatus } from "@/lib/accounting/db";
import { parseBankCSV, ordneZu, type OffeneRechnung } from "@/lib/accounting/bank-csv";
import { listItems } from "@/lib/store";
import { toInvoice } from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Offene Rechnungen aus dem Rechnungen-Modul für den Abgleich. */
async function offeneRechnungen(): Promise<OffeneRechnung[]> {
  const roh = await listItems("invoices");
  return roh
    .map(toInvoice)
    .filter((i) => i.payment_status === "open" || i.payment_status === "partial")
    .map((i) => ({
      id: i.id,
      invoice_id: i.invoice_id,
      company: i.company ?? "",
      customer_name: i.customer_name ?? "",
      amount_cent: Math.round((i.amount ?? 0) * 100),
    }));
}

export async function GET() {
  const [umsaetze, rechnungen] = await Promise.all([
    ladeBankUmsaetze("offen"),
    offeneRechnungen(),
  ]);
  const vorschlaege = ordneZu(umsaetze, rechnungen);
  return NextResponse.json({ umsaetze, vorschlaege });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulardaten fehlen." }, { status: 400 });

  const datei = form.get("datei");
  if (!(datei instanceof File)) {
    return NextResponse.json({ error: "Keine CSV-Datei erhalten." }, { status: 400 });
  }
  if (datei.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei ist zu groß (max. 10 MB)." }, { status: 400 });
  }

  // Banken liefern oft Windows-1252; UTF-8 zuerst, bei Ersatzzeichen umschalten.
  const bytes = Buffer.from(await datei.arrayBuffer());
  let text = bytes.toString("utf8");
  if (text.includes("�")) text = bytes.toString("latin1");

  const { umsaetze, uebersprungen, fehler } = parseBankCSV(text);
  if (fehler.length && !umsaetze.length) {
    return NextResponse.json({ error: fehler.join(" ") }, { status: 400 });
  }

  const { neu, duplikate } = await importiereBankUmsaetze(umsaetze);
  const [offen, rechnungen] = await Promise.all([ladeBankUmsaetze("offen"), offeneRechnungen()]);
  const vorschlaege = ordneZu(offen, rechnungen);

  return NextResponse.json({
    gelesen: umsaetze.length,
    neu,
    duplikate,
    uebersprungen,
    vorschlaege,
  });
}

/** Zuordnung bestätigen oder Umsatz ignorieren. */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    umsatz_id?: string;
    rechnung_id?: string | null;
    status?: "zugeordnet" | "ignoriert" | "offen";
  };
  if (!body.umsatz_id || !body.status) {
    return NextResponse.json({ error: "umsatz_id und status sind erforderlich." }, { status: 400 });
  }
  await setzeBankStatus(body.umsatz_id, body.status, body.rechnung_id ?? null);
  return NextResponse.json({ ok: true });
}
