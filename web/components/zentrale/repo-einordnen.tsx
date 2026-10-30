"use client";
import { repoZuordnen } from "@/lib/zentrale/aktionen";
import { BEREICHE } from "@/lib/zentrale/register";
import { Formular, Senden } from "./formular";
import { feldKlasse } from "./stil";

export function RepoEinordnen({ repo }: { repo: string }) {
  return (
    <Formular aktion={repoZuordnen} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="repo" value={repo} />
      <select name="art" aria-label={`${repo} einordnen als`} className={`${feldKlasse} w-auto`} defaultValue="intern">
        <option value="intern">Eigene App (intern)</option>
        <option value="produkt">Eigenes Produkt</option>
        <option value="kunde">Kundenprojekt, ausblenden</option>
        <option value="abgelegt">Abgelegt, ausblenden</option>
      </select>
      <select name="bereich" aria-label="Bereich" className={`${feldKlasse} w-auto`} defaultValue="Betrieb">
        {BEREICHE.filter((b) => b !== "Zentrale").map((b) => <option key={b}>{b}</option>)}
      </select>
      <Senden variante="zweit">Einordnen</Senden>
    </Formular>
  );
}
