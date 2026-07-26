import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BankImport } from "@/components/buchhaltung/bank-import";
import { ladeBankUmsaetze } from "@/lib/accounting/db";
import { ordneZu, type OffeneRechnung } from "@/lib/accounting/bank-csv";
import { formatCent } from "@/lib/accounting/buchen";
import { listItems } from "@/lib/store";
import { toInvoice } from "@/lib/invoices";

export const dynamic = "force-dynamic";

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

export default async function Page() {
  const [offen, alle, rechnungen] = await Promise.all([
    ladeBankUmsaetze("offen", 100),
    ladeBankUmsaetze(undefined, 200),
    offeneRechnungen(),
  ]);
  const vorschlaege = ordneZu(offen, rechnungen);
  const zugeordnet = alle.filter((u) => u.status !== "offen");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bank</h1>
          <p className="text-sm text-muted-foreground">
            {offen.length} offen · {zugeordnet.length} erledigt
          </p>
        </div>
        <Link href="/buchhaltung" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Übersicht
        </Link>
      </div>

      <BankImport vorschlaege={vorschlaege} />

      <Card>
        <CardHeader>
          <CardTitle>Nicht zugeordnete Umsätze</CardTitle>
        </CardHeader>
        <CardContent>
          {offen.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine offenen Umsätze. Lade oben einen Kontoauszug hoch.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Datum</th>
                    <th className="py-2 pr-3 font-medium">Partner</th>
                    <th className="py-2 pr-3 font-medium">Verwendungszweck</th>
                    <th className="py-2 pr-3 text-right font-medium">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {offen.map((u) => (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {u.datum.split("-").reverse().join(".")}
                      </td>
                      <td className="py-2 pr-3">{u.partner ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {u.verwendungszweck?.slice(0, 90) ?? "—"}
                      </td>
                      <td className={`py-2 pr-3 text-right whitespace-nowrap font-medium ${
                        u.betrag_cent < 0 ? "text-rust" : "text-primary"
                      }`}>
                        {formatCent(u.betrag_cent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
