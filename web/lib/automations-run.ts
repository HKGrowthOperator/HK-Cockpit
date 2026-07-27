// lib/automations-run.ts — Automationen aus dem Cockpit heraus starten.
//
// Warum Webhook und nicht die n8n-API: Die öffentliche n8n-API kann Workflows
// anlegen, aktivieren und Läufe auslesen — aber nicht ausführen. Jeder
// generierte Workflow hat deshalb einen Webhook-Auslöser unter dem festen Pfad
// `hk/<automation-id>`; genau den ruft der „Jetzt starten"-Knopf auf.

/** Basis-URL der n8n-Instanz, z. B. https://n8n.example.com (ohne Schrägstrich). */
export function n8nBasisUrl(): string {
  return (process.env.N8N_BASE_URL ?? "").replace(/\/+$/, "");
}

export function n8nKonfiguriert(): boolean {
  return n8nBasisUrl().length > 0;
}

/** Die Automations-ID aus dem Katalog (data.id), z. B. "aut-lead-radar". */
export function istStartbar(automationId: unknown): automationId is string {
  return typeof automationId === "string" && /^aut-[a-z0-9-]+$/.test(automationId);
}

/** Webhook-Adresse eines Workflows. `test` nutzt den Testpfad, den n8n
 *  anbietet, solange ein Workflow noch nicht aktiviert ist. */
export function webhookUrl(automationId: string, test = false): string {
  const pfad = test ? "webhook-test" : "webhook";
  return `${n8nBasisUrl()}/${pfad}/hk/${automationId}`;
}

export type StartErgebnis =
  | { ok: true; hinweis?: string; antwort?: unknown }
  | { ok: false; fehler: string; hinweis?: string };

/** Ruft den Webhook des Workflows auf. Wirft nie — Fehler kommen als Ergebnis
 *  zurück, damit die Oberfläche sie im Klartext anzeigen kann. */
export async function starteAutomation(
  automationId: string,
  nutzlast: Record<string, unknown> = {},
): Promise<StartErgebnis> {
  if (!n8nKonfiguriert()) {
    return {
      ok: false,
      fehler: "n8n ist nicht verbunden.",
      hinweis: "N8N_BASE_URL in den Umgebungsvariablen des Cockpits eintragen.",
    };
  }

  const secret = process.env.AUTOMATION_INGEST_SECRET ?? "";
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), 30_000);

  try {
    const res = await fetch(webhookUrl(automationId), {
      method: "POST",
      signal: abbruch.signal,
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-automation-secret": secret } : {}),
      },
      body: JSON.stringify({ quelle: "cockpit", gestartet_am: new Date().toISOString(), ...nutzlast }),
    });

    if (res.ok) {
      const antwort = await res.json().catch(() => null);
      return { ok: true, antwort };
    }

    // 404 heißt bei n8n fast immer: Workflow ist nicht aktiviert.
    if (res.status === 404) {
      return {
        ok: false,
        fehler: "Workflow ist in n8n nicht aktiv.",
        hinweis: "In n8n öffnen und oben rechts auf Active stellen.",
      };
    }
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      fehler: `n8n antwortete mit ${res.status}.`,
      hinweis: text.slice(0, 200) || undefined,
    };
  } catch (err) {
    const abgebrochen = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      fehler: abgebrochen
        ? "n8n hat nicht innerhalb von 30 Sekunden geantwortet."
        : "n8n ist nicht erreichbar.",
      hinweis: abgebrochen
        ? "Der Workflow läuft möglicherweise trotzdem weiter — im Verlauf nachsehen."
        : "Läuft die n8n-Ressource? Stimmt N8N_BASE_URL?",
    };
  } finally {
    clearTimeout(wecker);
  }
}
