# HK Cockpit

Die Zentrale von HK Growth Operator: alle eigenen Apps und Repos auf einen
Blick, mit Status, Code-Stand, Aktivität, Direktsprüngen in jede App,
Mail-Automation mit Freigabe, Buchhaltung, Rechnungen und den 31 n8n-Automationen.

Sales App 2.0 und Coldmail laufen bewusst eigenständig und sind nur angebunden
(Link, Status, Ereignisse), nie beschrieben.

| Dokument | Inhalt |
|---|---|
| [ZENTRALE.md](ZENTRALE.md) | Apps-Register, GitHub, Ereignisse, Mail-Automation, Rollen |
| [AUTOMATIONEN.md](AUTOMATIONEN.md) | n8n-Workflows per Knopfdruck starten |
| [BUCHHALTUNG.md](BUCHHALTUNG.md) | doppelte Buchführung, Belege, DATEV |

## Starten

```bash
# Server (Coolify / Docker)
docker compose -f docker-compose.server.yml --env-file .env up -d --build
# lokal
docker compose -f docker-compose.local.yml up -d     # http://localhost:3000
```

Erster Login: `node scripts/create-user.mjs <email> <passwort> --name <Vorname> --rolle gf`
(im Ordner `web/`, mit `DATABASE_URL`).

## Entwickeln

```bash
cd web
npm ci
npm run dev
npm run typecheck && npm test && npm run build
```
