"use client";
// Formulare für Vorlagen, Automationen (Regeln) und Postfächer der Mail-Zentrale.
import { useState } from "react";
import { kontoSpeichern, regelSpeichern, vorlageSpeichern } from "@/lib/zentrale/aktionen";
import { Feld, Formular, Senden } from "./formular";
import { feldKlasse } from "./stil";

export function VorlageFormular({ v }: { v?: { id: string; name: string; zweck: string | null; betreff: string; text: string } }) {
  return (
    <Formular aktion={vorlageSpeichern} className="flex flex-col gap-3" zuruecksetzen={!v}>
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Name"><input name="name" required defaultValue={v?.name} placeholder="z. B. Rückmeldung auf Website-Anfrage" className={feldKlasse} /></Feld>
        <Feld label="Wofür"><input name="zweck" defaultValue={v?.zweck ?? ""} placeholder="kurz, für das Team" className={feldKlasse} /></Feld>
      </div>
      <Feld label="Betreff"><input name="betreff" required defaultValue={v?.betreff} className={feldKlasse} /></Feld>
      <Feld label="Text" hinweis="Platzhalter: {{name}}, {{email}}, {{company}} … oder mit Ersatz: {{company | eure Firma}}. Fehlt ein Wert ohne Ersatz, geht die Mail nie automatisch raus.">
        <textarea name="text" required rows={10} defaultValue={v?.text} className={`${feldKlasse} leading-relaxed`} />
      </Feld>
      {v && <p className="text-muted-foreground text-xs">Wer den Text ändert, hebt die Freigabe auf. Automationen mit dieser Vorlage legen Mails dann wieder zur Freigabe vor.</p>}
      <div><Senden>{v ? "Änderungen speichern" : "Vorlage anlegen"}</Senden></div>
    </Formular>
  );
}

export type AppWahl = { id: string; name: string; arten: string[]; felder: string[] };
export type Wahl = { id: string; text: string };

export function RegelFormular({ apps, vorlagen, konten, istGF, r }: {
  apps: AppWahl[]; vorlagen: Wahl[]; konten: Wahl[]; istGF: boolean;
  r?: { id: string; name: string; app_id: string; art: string; vorlage_id: string; konto_id: string | null; empfaenger: string; modus: string; verzoegerung_min: number };
}) {
  const [appId, setAppId] = useState(r?.app_id ?? apps[0]?.id ?? "");
  const app = apps.find((a) => a.id === appId);
  if (!vorlagen.length) return <p className="text-muted-foreground text-sm">Lege zuerst eine Vorlage an.</p>;
  return (
    <Formular aktion={regelSpeichern} className="flex flex-col gap-3" zuruecksetzen={!r}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <Feld label="Name"><input name="name" defaultValue={r?.name} placeholder="z. B. Website-Anfrage: Nachfassen nach 2 Tagen" className={feldKlasse} /></Feld>
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Wenn in">
          <select name="app_id" value={appId} onChange={(e) => setAppId(e.target.value)} className={feldKlasse}>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Feld>
        <Feld label="das passiert">
          <select name="art" defaultValue={r?.art} key={appId} className={feldKlasse}>
            {app?.arten.map((x) => <option key={x}>{x}</option>)}
            <option value="*">jedes Ereignis</option>
          </select>
        </Feld>
        <Feld label="dann diese Vorlage">
          <select name="vorlage_id" defaultValue={r?.vorlage_id} className={feldKlasse}>
            {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.text}</option>)}
          </select>
        </Feld>
        <Feld label="über das Postfach">
          <select name="konto_id" defaultValue={r?.konto_id ?? ""} className={feldKlasse}>
            <option value="">Standard-Postfach</option>
            {konten.map((k) => <option key={k.id} value={k.id}>{k.text}</option>)}
          </select>
        </Feld>
        <Feld label="an" hinweis={app ? `Verfügbar: ${app.felder.map((f) => `{{${f}}}`).join(" ")}` : undefined}>
          <input name="empfaenger" required defaultValue={r?.empfaenger ?? (app?.felder.includes("email") ? "{{email}}" : "")} key={`an-${appId}`} className={feldKlasse} />
        </Feld>
        <Feld label="nach Minuten" hinweis="0 = sofort, 2880 = zwei Tage">
          <input name="verzoegerung_min" type="number" min={0} max={43200} defaultValue={r?.verzoegerung_min ?? 0} className={feldKlasse} />
        </Feld>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Versand</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="modus" value="freigabe" defaultChecked={r?.modus !== "automatisch"} className="mt-1" />
          <span>Zur Freigabe vorlegen. Ein Mensch sieht jede Mail, bevor sie rausgeht.</span>
        </label>
        <label className={`flex items-start gap-2 text-sm ${istGF ? "" : "opacity-50"}`}>
          <input type="radio" name="modus" value="automatisch" defaultChecked={r?.modus === "automatisch"} disabled={!istGF} className="mt-1" />
          <span>Automatisch senden, wenn die Vorlage freigegeben ist und kein Platzhalter leer bleibt.{istGF ? "" : " Nur die Geschäftsführung."}</span>
        </label>
      </fieldset>
      <div><Senden>{r ? "Automation speichern" : "Automation anlegen"}</Senden></div>
    </Formular>
  );
}

export function KontoFormular({ k }: {
  k?: { id: string; name: string; absender_name: string; absender_adresse: string; antwort_an: string | null; smtp_host: string; smtp_port: number; smtp_user: string; signatur: string | null; tageslimit: number; standard: boolean };
}) {
  return (
    <Formular aktion={kontoSpeichern} className="flex flex-col gap-3" zuruecksetzen={!k}>
      {k && <input type="hidden" name="id" value={k.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Absendername"><input name="absender_name" required defaultValue={k?.absender_name ?? "HK Growth Operator"} className={feldKlasse} /></Feld>
        <Feld label="Absenderadresse"><input name="absender_adresse" type="email" required defaultValue={k?.absender_adresse} placeholder="info@hk-growthoperator.de" className={feldKlasse} /></Feld>
        <Feld label="Antworten an" hinweis="Optional, sonst an die Absenderadresse."><input name="antwort_an" type="email" defaultValue={k?.antwort_an ?? ""} className={feldKlasse} /></Feld>
        <Feld label="Bezeichnung"><input name="name" defaultValue={k?.name} placeholder="z. B. Info-Postfach" className={feldKlasse} /></Feld>
        <Feld label="SMTP-Server" hinweis="all-inkl: w0…kasserver.com aus dem KAS"><input name="smtp_host" required defaultValue={k?.smtp_host} className={feldKlasse} /></Feld>
        <Feld label="Port" hinweis="465 = SSL, 587 = STARTTLS">
          <select name="smtp_port" defaultValue={String(k?.smtp_port ?? 465)} className={feldKlasse}>
            <option value="465">465</option><option value="587">587</option><option value="2525">2525</option>
          </select>
        </Feld>
        <Feld label="Benutzername" hinweis="meist die Mailadresse"><input name="smtp_user" defaultValue={k?.smtp_user} className={feldKlasse} /></Feld>
        <Feld label="Passwort" hinweis={k ? "Leer lassen, um es zu behalten." : "Wird verschlüsselt gespeichert."}>
          <input name="smtp_pass" type="password" autoComplete="new-password" required={!k} className={feldKlasse} />
        </Feld>
        <Feld label="Tageslimit" hinweis="Danach geht es am nächsten Morgen weiter."><input name="tageslimit" type="number" min={1} max={2000} defaultValue={k?.tageslimit ?? 200} className={feldKlasse} /></Feld>
      </div>
      <Feld label="Signatur"><textarea name="signatur" rows={4} defaultValue={k?.signatur ?? ""} placeholder={"Viele Grüße\nLuis Kummer\nHK Growth Operator"} className={feldKlasse} /></Feld>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="standard" defaultChecked={k?.standard} /> Standard-Postfach</label>
      <p className="text-muted-foreground text-xs">Beim Speichern meldet sich das Cockpit am Mailserver an. Nur ein Postfach, das wirklich senden kann, wird gespeichert.</p>
      <div><Senden>{k ? "Postfach speichern" : "Postfach prüfen und anlegen"}</Senden></div>
    </Formular>
  );
}
