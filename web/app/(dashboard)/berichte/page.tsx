import { ReportStudio } from "@/components/report-studio";
import { listItems } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [clientItems, reportItems] = await Promise.all([listItems("clients"), listItems("reports")]);
  const clients = clientItems
    .map((c) => ({ name: String((c.data as Record<string, unknown>).name ?? "") }))
    .filter((c) => c.name);
  const reports = reportItems.map((r) => {
    const d = r.data as Record<string, unknown>;
    return {
      id: r.id,
      client: d.client as string | undefined,
      week: d.week as string | undefined,
      date: d.date as string | undefined,
      body: d.body as string | undefined,
    };
  });
  return <ReportStudio clients={clients} reports={reports} />;
}
