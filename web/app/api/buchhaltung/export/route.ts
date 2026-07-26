// API: Buchungen exportieren — DATEV-Buchungsstapel oder einfaches CSV.
import { ladeBuchungen, ladeEinstellungen } from "@/lib/accounting/db";
import { datevExport, csvExport } from "@/lib/accounting/datev";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jahr = Number(url.searchParams.get("jahr")) || new Date().getFullYear();
  const format = url.searchParams.get("format") === "csv" ? "csv" : "datev";

  const [buchungen, einstellungen] = await Promise.all([
    ladeBuchungen({ jahr, limit: 5000 }),
    ladeEinstellungen(),
  ]);

  const inhalt =
    format === "csv"
      ? csvExport(buchungen)
      : datevExport(buchungen, {
          firma: einstellungen.firma ?? "HK Growth Operator",
          jahr,
          rahmen: einstellungen.kontenrahmen,
        });

  const name =
    format === "csv"
      ? `buchungen-${jahr}.csv`
      : `EXTF_Buchungsstapel_${jahr}.csv`;

  // DATEV erwartet Windows-1252; Umlaute sonst falsch im Steuerprogramm.
  const body = format === "datev" ? Buffer.from(inhalt, "latin1") : Buffer.from(inhalt, "utf8");

  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": `text/csv; charset=${format === "datev" ? "windows-1252" : "utf-8"}`,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
