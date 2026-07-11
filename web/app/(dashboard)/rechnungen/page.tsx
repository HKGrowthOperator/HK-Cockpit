import { ModuleView } from "@/components/module-view";
import { StatCard } from "@/components/stat-card";
import { InvoiceFollowup, type FollowupItem } from "@/components/invoice-followup";
import { loadModule, listItems } from "@/lib/store";
import { MODULES } from "@/lib/modules";
import {
  toInvoice,
  financeSummary,
  generateReminderMessage,
  reminderStage,
  formatEUR,
  STAGE_THRESHOLDS,
  type ReminderStage,
} from "@/lib/invoices";

export const dynamic = "force-dynamic";

// Reihenfolge der Stufen für die Verteilungs-Anzeige (ohne "none").
const ACTIVE_STAGES: ReminderStage[] = ["due_today", "reminder", "first_dunning", "second_dunning"];

export default async function Page() {
  const [cards, raw] = await Promise.all([loadModule("invoices"), listItems("invoices")]);
  const invoices = raw.map(toInvoice);
  const def = MODULES.invoices;

  const summary = financeSummary(invoices);

  // Fällige/überfällige Rechnungen mit fertigem Erinnerungs-Entwurf.
  const followups: FollowupItem[] = invoices
    .map((inv) => ({ inv, msg: generateReminderMessage(inv), info: reminderStage(inv) }))
    .filter((x) => x.msg)
    .sort((a, b) => b.info.days - a.info.days)
    .map(({ inv, msg }) => ({
      id: inv.id,
      invoice_id: inv.invoice_id,
      company: inv.company,
      customer_name: inv.customer_name,
      stage: msg!.stage,
      stageLabel: STAGE_THRESHOLDS[msg!.stage].label,
      days: msg!.days,
      amount: formatEUR(inv.amount),
      subject: msg!.subject,
      body: msg!.body,
      needsReview: msg!.needs_human_review,
      customer_type: inv.customer_type,
      communication_style: inv.communication_style,
    }));

  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Offene Rechnungen überwachen, Erinnerungen je Mahnstufe erzeugen und Außenstände im Blick behalten.
      </p>

      {/* Liquiditäts-Kennzahlen */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Offene Posten" value={`${formatEUR(summary.sum_open)} €`} hint={`${summary.count_open} Rechnungen`} />
        <StatCard label="Davon überfällig" value={`${formatEUR(summary.sum_overdue)} €`} tone={summary.sum_overdue > 0 ? "bad" : "good"} />
        <StatCard label="Ø Überfälligkeit" value={`${summary.avg_days_overdue} Tage`} tone={summary.avg_days_overdue > 14 ? "warn" : "default"} hint="DSO-Indikator" />
        <StatCard label="Offene Aktionen" value={String(summary.actions_count)} hint="Erinnerungen fällig" tone={summary.actions_count > 0 ? "warn" : "good"} />
      </section>

      {/* Verteilung nach Mahnstufe */}
      <section className="mb-8 flex flex-wrap gap-2">
        {ACTIVE_STAGES.map((s) => (
          <span key={s} className="bg-card border-border flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
            <strong className="tabular-nums">{summary.count_by_stage[s]}</strong>
            <span className="text-muted-foreground">{STAGE_THRESHOLDS[s].label}</span>
          </span>
        ))}
        {summary.top_risks[0] && (
          <span className="text-rust border-rust/40 ml-auto flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
            Top-Risiko: {summary.top_risks[0].invoice_id} · {formatEUR(summary.top_risks[0].amount)} € · {summary.top_risks[0].days} Tage
          </span>
        )}
      </section>

      {/* Erinnerungs-Generierung */}
      <h2 className="font-serif mb-3 text-lg font-bold">Fällige Erinnerungen</h2>
      <div className="mb-10">
        <InvoiceFollowup items={followups} />
      </div>

      {/* Vollständige Verwaltung (CRUD) */}
      <h2 className="font-serif mb-3 text-lg font-bold">Alle Rechnungen</h2>
      <ModuleView module="invoices" path="/rechnungen" noun={def.noun} fields={def.fields} items={cards} min="380px" />
    </>
  );
}
