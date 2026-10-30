"use client";
import { githubTokenLoeschen, githubTokenSpeichern } from "@/lib/zentrale/aktionen";
import { AktionsKnopf } from "./aktions-knopf";
import { Feld, Formular, Senden } from "./formular";
import { feldKlasse } from "./stil";

export function GithubEinstellungen({ quelle, istGF }: { quelle: "umgebung" | "app" | "keine"; istGF: boolean }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        {quelle === "umgebung" && "Verbunden über GITHUB_TOKEN aus der Umgebung."}
        {quelle === "app" && "Verbunden. Der Token liegt verschlüsselt in der Datenbank."}
        {quelle === "keine" && "Nicht verbunden. Ohne Verbindung fehlen Code-Stand, Pull Requests, CI und die Erkennung neuer Repositories."}
      </p>
      <p className="text-muted-foreground">
        Am besten ein Fine-grained Token für die Organisation HKGrowthOperator, nur lesend: Contents, Metadata, Pull requests, Actions.
        Anlegen unter github.com → Settings → Developer settings → Fine-grained tokens.
      </p>
      {istGF && quelle !== "umgebung" && (
        <Formular aktion={githubTokenSpeichern} className="flex flex-col gap-3">
          <Feld label={quelle === "app" ? "Token ersetzen" : "Token"}>
            <input name="token" type="password" autoComplete="off" placeholder="github_pat_…" className={feldKlasse} />
          </Feld>
          <div className="flex flex-wrap gap-2">
            <Senden>Prüfen und verbinden</Senden>
          </div>
        </Formular>
      )}
      {istGF && quelle === "app" && (
        <div><AktionsKnopf aktion={githubTokenLoeschen} variante="gefahr" frage="GitHub-Verbindung trennen?">Verbindung trennen</AktionsKnopf></div>
      )}
      {!istGF && <p className="text-muted-foreground">Die Verbindung richtet die Geschäftsführung ein.</p>}
    </div>
  );
}
