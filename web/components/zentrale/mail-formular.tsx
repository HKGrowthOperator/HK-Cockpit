"use client";
import { useRef } from "react";
import { mailSpeichern } from "@/lib/zentrale/aktionen";
import { Feld, Formular, Senden } from "./formular";
import { feldKlasse } from "./stil";

export type KontoWahl = { id: string; text: string };
export type VorlageWahl = { id: string; name: string; betreff: string; text: string };

export function MailFormular({ konten, vorlagen, start }: {
  konten: KontoWahl[];
  vorlagen: VorlageWahl[];
  start: { id?: string; an?: string; betreff?: string; text?: string; konto_id?: string; schluessel?: string; herkunft?: string };
}) {
  const betreff = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const vorlage = useRef<HTMLInputElement>(null);
  return (
    <Formular aktion={mailSpeichern} className="flex max-w-3xl flex-col gap-4" zuruecksetzen={!start.id}>
      {start.id && <input type="hidden" name="id" value={start.id} />}
      {start.schluessel && <input type="hidden" name="schluessel" value={start.schluessel} />}
      {start.herkunft && <input type="hidden" name="herkunft" value={start.herkunft} />}
      <input type="hidden" name="vorlage_id" ref={vorlage} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Von">
          <select name="konto_id" defaultValue={start.konto_id ?? ""} className={feldKlasse}>
            {konten.map((k) => <option key={k.id} value={k.id}>{k.text}</option>)}
          </select>
        </Feld>
        {vorlagen.length > 0 && (
          <Feld label="Vorlage einsetzen" hinweis="Platzhalter wie {{name}} danach von Hand ersetzen.">
            <select defaultValue="" className={feldKlasse} onChange={(e) => {
              const v = vorlagen.find((x) => x.id === e.target.value);
              if (!v) return;
              if (betreff.current) betreff.current.value = v.betreff;
              if (text.current) text.current.value = v.text;
              if (vorlage.current) vorlage.current.value = v.id;
            }}>
              <option value="">keine</option>
              {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Feld>
        )}
      </div>
      <Feld label="An">
        <input name="an" type="email" required defaultValue={start.an} placeholder="name@firma.de" className={feldKlasse} />
      </Feld>
      <Feld label="Betreff">
        <input ref={betreff} name="betreff" required defaultValue={start.betreff} className={feldKlasse} />
      </Feld>
      <Feld label="Text" hinweis="Reiner Text. Die Signatur des Postfachs wird automatisch angehängt.">
        <textarea ref={text} name="text" required rows={12} defaultValue={start.text} className={`${feldKlasse} font-sans leading-relaxed`} />
      </Feld>
      <div className="flex flex-wrap gap-2">
        <Senden name="absicht" value="senden">Jetzt senden</Senden>
        <Senden name="absicht" value="entwurf" variante="zweit">Als Entwurf speichern</Senden>
      </div>
    </Formular>
  );
}
