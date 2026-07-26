# n8n getrennt betreiben (empfohlen)

n8n lief bisher **im selben Compose-Projekt wie das Cockpit**. Das hatte eine
unangenehme Folge: Wenn n8n beim Start abbrach (z. B. `EACCES` wegen
root-eigenem Bind-Mount), zaehlte Coolify die Restarts des *gesamten* Stacks
und stoppte nach 10 Versuchen **alles** — auch das funktionierende Cockpit.
Getrennt kann das nicht mehr passieren.

```
vorher                             nachher
┌───────────────────────────┐      ┌────────────────┐  ┌──────────────┐
│ HK-Cockpit                │      │ HK-Cockpit     │  │ n8n          │
│  postgres + web + n8n     │      │ postgres + web │  │ (eigene App) │
│  n8n crasht → alles aus   │      │ laeuft stabil  │  │ eigene Domain│
└───────────────────────────┘      └────────────────┘  └──────────────┘
```

## Einrichten in Coolify

1. **+ New → Docker Compose (Empty)** (oder *Public Repository* mit diesem Repo
   und **Base Directory** = `/n8n-standalone`).
2. Inhalt von `docker-compose.yaml` einfuegen bzw. Repo waehlen.
3. **Environment Variables** setzen:

   | Name | Wert |
   |---|---|
   | `N8N_ENCRYPTION_KEY` | **derselbe** Key wie bisher (aus der alten `.env`) |
   | `COCKPIT_LOG_URL` | `http://<cockpit-web-container>:3000/api/automations/log` |
   | `AUTOMATION_INGEST_SECRET` | derselbe Wert wie im Cockpit |

   Der Encryption-Key ist entscheidend: Ohne den **exakt gleichen** Key kann
   n8n die in den Workflows gespeicherten Zugangsdaten nicht mehr entschluesseln.

4. **Deploy**. Coolify vergibt automatisch eine Domain und routet sie auf Port
   5678 (dank `SERVICE_FQDN_N8N_5678`) — es muss **kein** Port manuell in das
   Domain-Feld eingetragen werden.

## Workflows importieren (die 31 Cockpit-Automationen)

Im Terminal der **n8n**-Ressource:

```bash
n8n import:workflow --separate --input=/tmp/wf
```

Die JSON-Dateien liegen im Repo unter `n8n-workflows/`. Uebertragen z. B. per
`docker cp` vom Host oder ueber die n8n-Oberflaeche (*Workflows → Import from
File*). Nach dem Import sind alle Workflows **deaktiviert** — in der
Oberfläche gezielt aktivieren.

## Datenbank

Diese Variante nutzt die eingebaute SQLite-Datei im Volume `n8n_data` — das
genuegt fuer den Betrieb und haelt n8n unabhaengig von der Cockpit-Datenbank.
Wer die alten Workflows aus der bisherigen Postgres-DB `n8n` weiternutzen
will, setzt stattdessen:

```
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=<host der cockpit-postgres>
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=<POSTGRES_USER>
DB_POSTGRESDB_PASSWORD=<POSTGRES_PASSWORD>
```

Dafuer muss die Cockpit-Postgres im selben Docker-Netz erreichbar sein
(in Coolify: beide Ressourcen ins gleiche Netzwerk legen, *Connect to
predefined network*).

## Schnell-Import aller 31 Workflows (ein Befehl)

Im **Terminal der n8n-Ressource** in Coolify:

```bash
wget -qO /tmp/wf.json https://raw.githubusercontent.com/HKGrowthOperator/HK-Cockpit/main/n8n-standalone/alle-31-workflows.json && n8n import:workflow --input=/tmp/wf.json
```

Danach die n8n-Ressource **einmal neu starten** (Restart). Die Workflows sind
importiert und **deaktiviert** — in der Oberfläche gezielt aktivieren.

`alle-31-workflows.json` ist die Sammel-Datei aus `n8n-workflows/*.json`
(ein JSON-Array); `n8n import:workflow` liest Arrays direkt ein.
