"use client";
import { appEinstellungSpeichern } from "@/lib/zentrale/aktionen";
import { Feld, Formular, Senden } from "./formular";
import { feldKlasse } from "./stil";

export function AppEinstellungen({ appId, werte, vorgabe }: {
  appId: string;
  werte: { url: string; health: string; coolify_url: string; notiz: string };
  vorgabe: { url: string; health: string };
}) {
  return (
    <Formular aktion={appEinstellungSpeichern} className="flex flex-col gap-3">
      <input type="hidden" name="app_id" value={appId} />
      <Feld label="Adresse der App" hinweis={vorgabe.url ? `Leer lassen für die Vorgabe: ${vorgabe.url}` : "z. B. https://finanz.hk-growthoperator.de"}>
        <input name="url" type="url" defaultValue={werte.url} placeholder={vorgabe.url || "https://…"} className={feldKlasse} />
      </Feld>
      <Feld label="Prüfadresse" hinweis={vorgabe.health ? `Leer lassen für die Vorgabe: ${vorgabe.health}` : "Pfad wie /health oder volle Adresse. Leer: die Startseite wird geprüft."}>
        <input name="health" defaultValue={werte.health} placeholder={vorgabe.health || "/health"} className={feldKlasse} />
      </Feld>
      <Feld label="Coolify-Ressource" hinweis="Direktlink in Coolify, für Logs und Neustart.">
        <input name="coolify_url" type="url" defaultValue={werte.coolify_url} placeholder="https://…" className={feldKlasse} />
      </Feld>
      <Feld label="Notiz">
        <textarea name="notiz" rows={3} defaultValue={werte.notiz} className={feldKlasse} />
      </Feld>
      <div><Senden>Speichern</Senden></div>
    </Formular>
  );
}
