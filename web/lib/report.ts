// lib/report.ts — erzeugt fertige Wochenreports pro Kunde aus den OS-Daten.
import type Anthropic from "@anthropic-ai/sdk";
import { getClientAsync, resolveModel } from "./assistant";
import { listItems } from "./store";

const SYSTEM = `Du schreibst professionelle, freundliche WOCHENREPORTS auf Deutsch, adressiert direkt an den Kunden (Sie-Form).

Aufbau:
1. Kurze persönliche Anrede + 1–2 Sätze Wochenüberblick.
2. „Diese Woche umgesetzt" — 2–5 konkrete Stichpunkte.
3. „Status & Ergebnisse" — kurzer, ehrlicher Stand.
4. „Nächste Schritte" — was als Nächstes ansteht.
5. Freundlicher Abschluss mit einer kurzen Rückfrage oder einem Ausblick.

Regeln:
- Deutsch, professionell und warm, konkret statt schwammig.
- Erfinde KEINE Zahlen, Termine oder Fakten, die nicht in den Daten/Notizen stehen. Fehlt etwas, formuliere ehrlich und allgemein.
- Nutze die mitgegebenen Kundendaten und Webseiten als Kontext.
- Gib NUR den fertigen Reporttext aus (keine Meta-Kommentare, keine Erklärung).`;

export async function generateReport(opts: {
  clientName: string;
  notes: string;
  model?: string;
}): Promise<{ report?: string; error?: string }> {
  const client = await getClientAsync();
  if (!client) return { error: "no-key" };

  const [clients, websites] = await Promise.all([listItems("clients"), listItems("websites")]);
  const c = clients.find((x) => String((x.data as Record<string, unknown>).name ?? "") === opts.clientName);
  const sites = websites.filter((w) => String((w.data as Record<string, unknown>).client ?? "") === opts.clientName);

  const ctx = [
    `Kundendaten: ${JSON.stringify(c?.data ?? { name: opts.clientName })}`,
    sites.length ? `Webseiten dieses Kunden: ${sites.map((s) => JSON.stringify(s.data)).join("; ")}` : "",
    opts.notes.trim()
      ? `Highlights/Notizen dieser Woche (vom Team — verbindlich verwenden):\n${opts.notes.trim()}`
      : "(Keine zusätzlichen Notizen — formuliere auf Basis des vorhandenen Kontexts sinnvolle, aber nicht erfundene Statuspunkte und halte unklare Stellen allgemein.)",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const resp = await client.messages.create({
      model: resolveModel(opts.model),
      max_tokens: 1800,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Erstelle den Wochenreport für „${opts.clientName}".\n\n${ctx}` }],
    });
    const report = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { report: report || "(leerer Report)" };
  } catch (err) {
    const e = err as { status?: number; message?: string; name?: string };
    if (e.name === "AuthenticationError") return { error: "Der API-Schlüssel wurde abgelehnt. Bitte ANTHROPIC_API_KEY prüfen." };
    if (e.name === "RateLimitError") return { error: "Rate-Limit oder Guthaben erreicht — bitte später erneut versuchen." };
    return { error: e.message ? `API-Fehler: ${e.message}` : "Unerwarteter Fehler bei der Report-Erstellung." };
  }
}
