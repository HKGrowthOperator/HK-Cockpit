# Automationen per Knopfdruck starten

Jede der 31 Automationen lässt sich im Cockpit unter **Automation** mit
**„Jetzt starten"** auslösen. Der Lauf erscheint sofort in der Übersicht.

## Wie das funktioniert

```
Cockpit  ──POST /api/automations/run──►  n8n
   │                                       │  Workflow läuft
   │                                       ▼
   └──────── agent_runs ◄──── POST /api/automations/log ────┘
              (Dashboard "live aus n8n")
```

Jeder Workflow hat drei Auslöser:

| Auslöser | wofür |
|---|---|
| **Start aus dem Cockpit** (Webhook) | der Knopf in der App |
| **Manuell starten** | Test direkt in n8n |
| **Zeitplan** | der reguläre automatische Lauf |

Der Webhook liegt auf dem festen Pfad `hk/<automations-id>`, zum Beispiel
`hk/aut-lead-radar`. Dadurch weiß das Cockpit ohne weitere Konfiguration,
welchen Workflow es rufen muss.

**Warum Webhook und nicht die n8n-API?** Die öffentliche n8n-API kann Workflows
anlegen, aktivieren und Läufe auslesen — aber nicht ausführen. Der Webhook ist
der einzige Weg, einen Workflow zuverlässig von außen zu starten.

## Einrichten (einmalig)

### 1. Cockpit mit n8n verbinden

In Coolify beim **HK-Cockpit** unter *Environment Variables*:

| Name | Wert |
|---|---|
| `N8N_BASE_URL` | Adresse der n8n-Ressource, z. B. `http://n8n:5678` im selben Docker-Netz oder die öffentliche Domain |
| `AUTOMATION_INGEST_SECRET` | dasselbe Secret wie in n8n (schützt Hin- und Rückweg) |

Danach **Redeploy**. Fehlt `N8N_BASE_URL`, bleibt der Knopf aus und die Seite
erklärt genau das — sie bricht nicht ab.

### 2. Workflows in n8n einspielen

Im Terminal der n8n-Ressource:

```bash
wget -qO /tmp/wf.json https://raw.githubusercontent.com/HKGrowthOperator/HK-Cockpit/main/n8n-standalone/alle-31-workflows.json && n8n import:workflow --input=/tmp/wf.json
```

Der Import überschreibt vorhandene Workflows mit gleicher ID — er dupliziert
nicht. Danach n8n **einmal neu starten**.

### 3. Workflows aktivieren

Ein Webhook antwortet nur, wenn der Workflow **aktiv** ist. In n8n den Workflow
öffnen und oben rechts auf **Active** stellen. Solange er inaktiv ist, meldet
das Cockpit im Klartext: *„Workflow ist in n8n nicht aktiv."*

Empfehlung: mit ein bis zwei Workflows anfangen, Ergebnis ansehen, dann die
übrigen aktivieren.

## Was beim Start passiert

1. Das Cockpit legt in `agent_runs` einen Lauf mit Status `running` an — der ist
   auch dann sichtbar, wenn n8n langsam ist oder nicht antwortet.
2. Es ruft den Webhook mit einer kleinen Nutzlast auf:
   `{ quelle: "cockpit", gestartet_am: …, automation: …, lauf_id: … }`.
3. Der Workflow läuft und meldet sich über den Rückkanal `/api/automations/log`
   zurück; diese Meldung überschreibt den vorläufigen Eintrag.
4. Antwortet n8n nicht innerhalb von 30 Sekunden, wird der Lauf als Fehler
   vermerkt — mit dem Hinweis, dass der Workflow trotzdem weiterlaufen kann.

## Fehlermeldungen und was sie bedeuten

| Meldung | Ursache | Lösung |
|---|---|---|
| n8n ist nicht verbunden | `N8N_BASE_URL` fehlt | Variable setzen, neu deployen |
| Workflow ist in n8n nicht aktiv | Webhook antwortet mit 404 | Workflow in n8n auf *Active* stellen |
| n8n ist nicht erreichbar | Ressource gestoppt oder falsche Adresse | n8n starten, Adresse prüfen |
| n8n hat nicht innerhalb von 30 Sekunden geantwortet | langer Workflow | Ergebnis im Verlauf nachsehen |

## Eigene Automationen

Neue Automationen legst du in der App unter **Automation → + Neu** an. Damit sie
startbar wird, braucht sie einen passenden Workflow in n8n mit dem Webhook-Pfad
`hk/<id>`. Am einfachsten: Eintrag in `web/lib/data/automations.json` ergänzen
und neu erzeugen lassen:

```bash
cd web && COCKPIT_LOG_URL=http://web:3000/api/automations/log \
  AUTOMATION_INGEST_SECRET=<secret> node scripts/gen-n8n-workflows.mjs
```

## Tests

```bash
cd web && npm run test:automationen
```

Prüft: Kennungs-Validierung, Webhook-Adressen, dass alle 31 Workflows einen
eindeutig verdrahteten Webhook und eine gültige ID haben, und dass Katalog und
Workflow-Dateien deckungsgleich sind.
