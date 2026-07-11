# n8n-Workflows für die 31 HK-Automationen

Diese JSON-Dateien werden aus `web/lib/data/automations.json` generiert
(`web/scripts/gen-n8n-workflows.mjs`). Jeder Workflow:

- **Manuell starten** + **Zeitplan** als Trigger
- **An Cockpit melden** (HTTP POST an `/api/automations/log` → Tabelle `agent_runs`
  → Dashboard „Automationen live aus n8n")
- Echte Tool-Aktionen (CRM, E-Mail, Slack …) werden pro Workflow hinter
  „An Cockpit melden" ergänzt.

Die eingecheckten Dateien sind die **lokale Dev-Variante**
(`host.docker.internal:3001`, ohne Secret).

## Deploy auf dem Server (Hetzner, Compose-Projekt `hk-cockpit`)

1. In `.env` setzen (siehe `.env.server.example`):
   `AUTOMATION_INGEST_SECRET=$(openssl rand -hex 32)`
2. Stack neu bauen: `docker compose -f docker-compose.server.yml --env-file .env up -d --build`
3. Workflows für den Server generieren (aus `web/`):
   ```bash
   COCKPIT_LOG_URL=http://web:3000/api/automations/log \
   AUTOMATION_INGEST_SECRET=<dasselbe-secret> \
   node scripts/gen-n8n-workflows.mjs
   ```
4. In n8n importieren:
   ```bash
   docker cp n8n-workflows/. hk-n8n:/tmp/wf/
   docker exec hk-n8n n8n import:workflow --separate --input=/tmp/wf
   docker restart hk-n8n
   ```
5. In der n8n-Oberfläche die gewünschten Workflows **aktivieren**
   (Import lässt alle deaktiviert).

Hinweise:
- `n8n import` überschreibt Workflows mit gleicher ID (idempotent).
- Windows/Git-Bash: vor `docker exec` mit `/tmp`-Pfaden `export MSYS_NO_PATHCONV=1`.
