# Die Zentrale

Das Cockpit führt alle Apps zusammen, die HK für sich selbst baut: Status,
Code-Stand, Aktivität, Direktsprünge in jede App und eine Mail-Automation mit
Freigabe. Kundenprojekte gehören nicht hinein.

**Sales App 2.0 und Coldmail bleiben eigenständig.** Das Cockpit verlinkt sie,
liest ihren Status und nimmt ihre Ereignisse entgegen — es schreibt nie in sie
hinein. Cold Mailing läuft ausschließlich in Coldmail.

## Aufbau

Auf der Übersicht als Baum gezeichnet:

| Teil | Was | Wo im Code |
|---|---|---|
| **Krone** | die Apps, nach Bereich, jede mit Statusfarbe | `lib/zentrale/register.ts` |
| **Stamm** | das Cockpit: Mail-Ausgang, Ereignisse, Automationen | `lib/zentrale/lage.ts`, `mail/` |
| **Wurzeln** | woraus es sich speist: GitHub, n8n, Postfach, Coolify, Backups | `github.ts`, `health.ts` |

| Seite | Wofür |
|---|---|
| `/` Übersicht | „Braucht dich“-Leiste, der Baum, gemeinsamer Aktivitätsstrom, Automationen |
| `/apps` | alle eigenen Apps mit Status, Code-Stand, PRs, CI; Werkzeugkasten; neue Repos einordnen |
| `/apps/<id>` | Bedienen (Direktlinks), Code, Ereignis-Eingang, Adressen und Notiz |
| `/aktivitaet` | ein Strom für Ereignisse, Mails, Automationsläufe und Code |
| `/mail` | Ausgang mit Freigabe, neue Mail, Vorlagen, Automationen, Postfächer |
| Strg + K | Befehlspalette: jede Seite, jede App, jeder Direktsprung |

## Welche Repos dazugehören

Das Register (`web/lib/zentrale/register.ts`) ist die versionierte Liste.
Stand der Prüfung am 30.10.2026 (40 eigene Repos in HKGrowthOperator, dazu 21 Forks):

- **Unsere Werkzeuge:** HK-Cockpit, KI-Assistent (HK OS), hk-Kern (Agenten-OS),
  Finanz, hk-outbound-os, Planungs-Kalender, HKGrowthOperator-Agent-Playbook,
  Website, WEBSEITE (Webstudio), HKGrowth-ads, Wachstums-Check (Adresse ohne Repo)
- **Eigene Produkte:** deal-Uno (DealUno-Website), Dealoperator, Anfrage-dashboard
- **Eigenständig:** Sales-App-2.0, Coldmail, Sales App V1 (nur Link)
- **Infrastruktur:** Backup-Server, n8n, Coolify, GitHub
- **Werkzeugkasten:** die 21 Forks (gstack, superpowers, claude-seo, hyperframes …),
  `lib/zentrale/werkzeuge.ts`
- **Ausgeblendet, Kunden:** CCRR-WEBSEITE, Merzenich-Aktuell, WebseiteMarelle,
  Marelle-Studio, Merzlicht, Tamil, KFZ-Oberberg, -kfz-oberberg-werkstatt,
  Fame-Caf-, Living-Charity, workspace-oberberg, hemmersbach-gmbh,
  melik-geruestbau, Demo-Heim-PArtner, GTTF
- **Abgelegt:** Sales-App (V1), HK-CockpitL (alte Kopie), DealUno-Website (abgelöst)
- **Noch offen:** Hypescore, Landigpageweb, Work, kunden-dashboard,
  DEMO-DASHBOARD, Luiskummer

Neue oder offene Repos erscheinen unter **Apps → Noch einzuordnen**, sobald
GitHub verbunden ist. Die Geschäftsführung ordnet sie dort mit einem Klick ein
(eigene App, Produkt, Kunde, abgelegt). Ein Test (`npm run test:zentrale`)
verhindert, dass ein Kundenrepo ins Register rutscht.

## Einrichten

### 1. Umgebung (Coolify → HK-Cockpit → Environment Variables)

| Variable | Wofür |
|---|---|
| `COCKPIT_URL` | öffentliche Adresse, für die Ereignis-Adressen der Apps |
| `ZENTRALE_SECRET_KEY` | verschlüsselt gespeicherte Geheimnisse. Einmal setzen, nie ändern |
| `ZENTRALE_TAKT_SECRET` | schützt den Mail-Takt |
| `N8N_PUBLIC_URL` | Link zur n8n-Oberfläche |
| `GITHUB_TOKEN` | optional, sonst in der App hinterlegen |
| `SMTP_*` | optional, Versand-Postfach ohne Eintrag in der App |

Danach neu deployen. Die neuen Tabellen legt das Cockpit beim ersten Aufruf
selbst an (bei frischen Installationen `db/init/04-zentrale.sql`).

### 2. GitHub verbinden

Fine-grained Token für die Organisation HKGrowthOperator, nur lesend:
Contents, Metadata, Pull requests, Actions. In der App unter
**Einstellungen → GitHub** eintragen — das Cockpit prüft ihn vor dem Speichern.

### 3. Adressen nachtragen

Für Apps ohne bekannte Adresse (Finanz, Outbound OS, Coolify …) unter
**Apps → App → Adressen und Notiz** die Adresse eintragen. Nur `https`.
Interne Netze (10.x, 192.168.x, localhost …) werden aus Sicherheitsgründen
nicht geprüft.

### 4. Ereignisse aus den Apps

**Webstudio (WEBSEITE):** Apps → HK Growth Webstudio → *Geheimnis erzeugen*.
In Coolify bei WEBSEITE setzen und neu deployen:

```
LEAD_WEBHOOK_URL=<COCKPIT_URL>/api/ereignisse/webstudio
LEAD_WEBHOOK_SECRET=<das angezeigte Geheimnis>
```

**Coldmail:** Apps → Coldmail → *Geheimnis erzeugen*, dann in Coldmail unter
Einstellungen → Webhook die Adresse
`<COCKPIT_URL>/api/ereignisse/coldmail` und das Geheimnis eintragen.

Geprüft wird dieselbe Signatur, die die Apps ohnehin senden
(`sha256=` + HMAC des Rumpfs). Dasselbe Ereignis zweimal legt nichts doppelt an.

### 5. Mail-Automation

1. **Postfach** (Mail → Postfächer): all-inkl-Server, Port 465. Das Cockpit
   meldet sich vor dem Speichern an; das Passwort liegt verschlüsselt.
2. **Vorlage** (Mail → Vorlagen) mit Platzhaltern wie `{{name}}` oder
   `{{company | eure Firma}}`.
3. **Automation** (Mail → Automationen): *Wenn in Webstudio „lead.created“
   passiert, dann Vorlage X an `{{email}}`, nach N Minuten.*
4. **Takt** für verzögerte Mails, alle 5 Minuten (Coolify Scheduled Task oder n8n):

   ```bash
   curl -fsS -X POST -H "x-takt-secret: $ZENTRALE_TAKT_SECRET" "$COCKPIT_URL/api/zentrale/takt"
   ```

**Was rausgeht, entscheidet ein Mensch.** Jede Mail landet im Ausgang und
wartet auf Freigabe — außer alle drei Bedingungen gelten:

- die Automation steht auf *automatisch* (das darf nur die Geschäftsführung),
- die Vorlage ist in **genau dieser Fassung** freigegeben (jede Textänderung
  hebt die Freigabe auf),
- kein Platzhalter blieb leer.

Ereignisse aus Sales App und Coldmail führen nur zu Mails an interne Adressen
(gleiche Domain wie das Postfach) — nach außen schreiben diese Apps selbst.
Zahlungserinnerungen lassen sich aus **Rechnungen** mit einem Klick als Entwurf
in den Ausgang legen.

Bricht ein Versand mittendrin ab, sendet das Cockpit **nicht** erneut, sondern
markiert die Mail: Ob sie draußen ist, weiß niemand. Erst im Postfach unter
„Gesendet“ nachsehen, dann neu freigeben.

## Rollen

| Rolle | darf |
|---|---|
| `gf` Geschäftsführung | alles, inklusive Automatik, Vorlagen-Freigabe, Postfächer, GitHub, Ereignis-Geheimnisse, Repos einordnen |
| `team` | alles Übrige: Mails schreiben und einzeln freigeben, Vorlagen und Automationen (zur Freigabe) anlegen, Adressen pflegen |

Bestehende Konten bleiben `gf`. Neue Personen:

```bash
node scripts/create-user.mjs mia@hk-growthoperator.de '<passwort>' --name Mia --rolle team
```

## Schnittstellen

| Pfad | Schutz | Zweck |
|---|---|---|
| `POST /api/ereignisse/<app>` | HMAC je App | Ereignisse aus Webstudio und Coldmail |
| `POST /api/zentrale/takt` | `x-takt-secret` | fällige Mails senden |
| `GET /api/zentrale/health` | offen | Lebenszeichen für Coolify |

## Prüfen

```bash
cd web
npm run typecheck
npm test              # Buchhaltung, Automationen, Zentrale
npm run build
```

`tests/zentrale.test.ts` prüft ohne Datenbank: Register (keine Kundenrepos,
Sales App 2.0 und Coldmail eigenständig), Platzhalter, die Versandentscheidung,
Signaturen, Verschlüsselung, die Bewertung der Erreichbarkeit, die Sperre
interner Netze und dass `db/init/04-zentrale.sql` zum Code passt.
