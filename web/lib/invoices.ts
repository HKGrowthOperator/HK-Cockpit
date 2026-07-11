// lib/invoices.ts — Kern-Logik des Invoice-Follow-Up-Systems (Portierung nach TS).
// Reine, abhängigkeitsfreie Funktionen: Mahnstufe, Überfälligkeit, Nachrichten-
// Entwurf und Finanz-Zusammenfassung. Wird von der Rechnungen-Seite genutzt.

export type PaymentStatus = "open" | "paid" | "partial" | "cancelled";
export type ReminderStage = "none" | "due_today" | "reminder" | "first_dunning" | "second_dunning";
export type CustomerType = "stammkunde" | "neukunde" | "grosskunde" | "kleinkunde" | "risiko";
export type CommunicationStyle = "formal" | "locker" | "neutral";

export type Invoice = {
  id: string;
  invoice_id: string;
  customer_name: string;
  company: string;
  invoice_date: string; // ISO YYYY-MM-DD
  due_date: string; // ISO YYYY-MM-DD
  amount: number;
  payment_status: PaymentStatus;
  customer_type: CustomerType;
  communication_style: CommunicationStyle;
  notes: string;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const CLOSED: PaymentStatus[] = ["paid", "cancelled"];

// Mahnstufen-Schwellen in Tagen Überfälligkeit (zentral konfigurierbar).
export const STAGE_THRESHOLDS: Record<ReminderStage, { min: number; max: number; label: string }> = {
  none: { min: -Infinity, max: -1, label: "Noch nicht fällig" },
  due_today: { min: 0, max: 0, label: "Am Fälligkeitstag" },
  reminder: { min: 1, max: 7, label: "Zahlungserinnerung" },
  first_dunning: { min: 8, max: 14, label: "1. Mahnung" },
  second_dunning: { min: 15, max: Infinity, label: "2. Mahnung" },
};

// Tage bis zur neuen Frist je Mahnstufe (für {{new_deadline}}).
const DEADLINE_DAYS: Partial<Record<ReminderStage, number>> = { first_dunning: 7, second_dunning: 5 };

const SENDER = {
  name: process.env.INVOICE_SENDER_NAME || "Buchhaltung HK Growth Operator",
  iban: process.env.INVOICE_SENDER_IBAN || "DE00 0000 0000 0000 0000 00",
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysOverdue(dueDate: string, today: string = todayISO()): number {
  const due = new Date(dueDate + "T00:00:00Z").getTime();
  const ref = new Date(today + "T00:00:00Z").getTime();
  return Math.round((ref - due) / MS_PER_DAY);
}

export function formatEUR(amount: number): string {
  return amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDays(today: string, n: number): string {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Bestimmt Mahnstufe und Überfälligkeit für eine Rechnung. */
export function reminderStage(
  inv: Pick<Invoice, "due_date" | "payment_status">,
  today: string = todayISO(),
): { stage: ReminderStage; days: number } {
  if (CLOSED.includes(inv.payment_status)) return { stage: "none", days: 0 };
  const days = daysOverdue(inv.due_date, today);
  const stage = (Object.keys(STAGE_THRESHOLDS) as ReminderStage[]).find((name) => {
    const { min, max } = STAGE_THRESHOLDS[name];
    return days >= min && days <= max;
  }) ?? "none";
  return { stage, days };
}

export type ReminderMessage = {
  invoice_id: string;
  stage: ReminderStage;
  days: number;
  subject: string;
  body: string;
  needs_human_review: boolean;
};

/** Erzeugt einen deterministischen Nachrichten-Entwurf passend zur Mahnstufe. */
export function generateReminderMessage(inv: Invoice, today: string = todayISO()): ReminderMessage | null {
  const { stage, days } = reminderStage(inv, today);
  if (stage === "none") return null;

  const amount = formatEUR(inv.amount);
  const deadline = DEADLINE_DAYS[stage] ? addDays(today, DEADLINE_DAYS[stage]!) : null;
  const partial = inv.payment_status === "partial"
    ? " (Teilzahlung bereits erhalten – es geht um den Restbetrag.)"
    : "";

  const subjects: Record<Exclude<ReminderStage, "none">, string> = {
    due_today: `Kurze Erinnerung: Rechnung ${inv.invoice_id} ist heute fällig`,
    reminder: `Zahlungserinnerung zu Rechnung ${inv.invoice_id}`,
    first_dunning: `1. Mahnung – Rechnung ${inv.invoice_id} überfällig`,
    second_dunning: `2. Mahnung / Letzte Zahlungsaufforderung – Rechnung ${inv.invoice_id}`,
  };

  const bodies: Record<Exclude<ReminderStage, "none">, string> = {
    due_today:
      `Hallo ${inv.customer_name},\n\nnur ein kurzer, freundlicher Hinweis: Unsere Rechnung ${inv.invoice_id} über ${amount} EUR ist heute fällig. Falls die Zahlung schon unterwegs ist, betrachten Sie diese Nachricht bitte als gegenstandslos.\n\nBeste Grüße\n${SENDER.name}`,
    reminder:
      `Hallo ${inv.customer_name},\n\nbei der Durchsicht unserer Buchhaltung ist mir aufgefallen, dass die Rechnung ${inv.invoice_id} über ${amount} EUR (fällig am ${inv.due_date}) noch offen ist.${partial} Das ist sicher nur untergegangen – ich wäre dankbar, wenn Sie den Betrag in den nächsten Tagen anweisen könnten.\n\nVielen Dank und beste Grüße\n${SENDER.name}`,
    first_dunning:
      `Sehr geehrte/r ${inv.customer_name},\n\ntrotz Fälligkeit am ${inv.due_date} konnten wir zur Rechnung ${inv.invoice_id} über ${amount} EUR bisher keinen Zahlungseingang feststellen (aktuell ${days} Tage überfällig).${partial} Wir bitten Sie, den Betrag bis spätestens ${deadline} auf folgendes Konto zu überweisen:\nIBAN: ${SENDER.iban}\nVerwendungszweck: ${inv.invoice_id}\n\nMit freundlichen Grüßen\n${SENDER.name}`,
    second_dunning:
      `Sehr geehrte/r ${inv.customer_name},\n\nleider ist die Rechnung ${inv.invoice_id} über ${amount} EUR weiterhin offen – inzwischen ${days} Tage über der Fälligkeit (${inv.due_date}) und trotz erster Mahnung.${partial} Wir fordern Sie letztmalig auf, den Betrag bis spätestens ${deadline} zu begleichen (IBAN: ${SENDER.iban}, Verwendungszweck: ${inv.invoice_id}). Andernfalls behalten wir uns weitere Schritte vor. Bei Zahlungsschwierigkeiten melden Sie sich bitte – wir finden eine Lösung.\n\nMit freundlichen Grüßen\n${SENDER.name}`,
  };

  return {
    invoice_id: inv.invoice_id,
    stage,
    days,
    subject: subjects[stage],
    body: bodies[stage],
    needs_human_review: stage === "second_dunning" || inv.customer_type === "risiko" || inv.amount > 5000,
  };
}

export type FinanceSummary = {
  count_open: number;
  sum_open: number;
  sum_overdue: number;
  avg_days_overdue: number;
  count_by_stage: Record<ReminderStage, number>;
  top_risks: { invoice_id: string; company: string; amount: number; days: number }[];
  actions_count: number;
};

/** Verdichtet alle Rechnungen zu Liquiditäts-Kennzahlen für die Übersicht. */
export function financeSummary(invoices: Invoice[], today: string = todayISO()): FinanceSummary {
  const active = invoices.filter((inv) => !CLOSED.includes(inv.payment_status));
  const withDays = active.map((inv) => ({ inv, ...reminderStage(inv, today) }));
  const overdue = withDays.filter((x) => x.days > 0);
  const sum = (arr: { inv: Invoice }[]) => arr.reduce((acc, x) => acc + x.inv.amount, 0);

  const count_by_stage: Record<ReminderStage, number> = {
    none: 0, due_today: 0, reminder: 0, first_dunning: 0, second_dunning: 0,
  };
  for (const x of withDays) count_by_stage[x.stage]++;

  const top_risks = [...overdue]
    .sort((a, b) => b.inv.amount * b.days - a.inv.amount * a.days)
    .slice(0, 5)
    .map((x) => ({ invoice_id: x.inv.invoice_id, company: x.inv.company, amount: x.inv.amount, days: x.days }));

  return {
    count_open: active.length,
    sum_open: Number(sum(withDays).toFixed(2)),
    sum_overdue: Number(sum(overdue).toFixed(2)),
    avg_days_overdue: overdue.length
      ? Math.round(overdue.reduce((a, x) => a + x.days, 0) / overdue.length)
      : 0,
    count_by_stage,
    top_risks,
    actions_count: withDays.filter((x) => x.stage !== "none").length,
  };
}

/** Wandelt einen Store-Datensatz (id + lose JSON-Felder) in eine getypte Invoice. */
export function toInvoice(rec: { id: string; data: Record<string, unknown> }): Invoice {
  const d = rec.data;
  const s = (v: unknown, fb = "") => (v == null ? fb : String(v));
  return {
    id: rec.id,
    invoice_id: s(d.invoice_id) || rec.id.slice(0, 8),
    customer_name: s(d.customer_name),
    company: s(d.company),
    invoice_date: s(d.invoice_date),
    due_date: s(d.due_date),
    amount: typeof d.amount === "number" ? d.amount : Number(d.amount) || 0,
    payment_status: (s(d.payment_status, "open") as PaymentStatus),
    customer_type: (s(d.customer_type, "neukunde") as CustomerType),
    communication_style: (s(d.communication_style, "neutral") as CommunicationStyle),
    notes: s(d.notes),
  };
}
