// lib/zentrale/register.ts — die Landkarte aller HK-eigenen Apps und Repos.
//
// Nur was HK für HK baut oder selbst als Produkt betreibt. Kundenprojekte
// (Kunden-Websites, Kunden-Dashboards) stehen bewusst NICHT hier — sie sind in
// KUNDEN_REPOS aufgeführt, damit ein Test verhindert, dass sie hineinrutschen.
//
// Adressen, die hier fehlen, lassen sich in der App je Eintrag nachtragen
// (Tabelle zentrale_app_einstellungen). Der Katalog bleibt die versionierte
// Grundlage, die Datenbank ergänzt nur.

export type Rolle =
  | "zentrale" // das Cockpit selbst
  | "intern" // internes Werkzeug von HK für HK
  | "produkt" // eigenes Produkt / eigene Marke, die HK betreibt
  | "eigenstaendig" // läuft bewusst getrennt — nur verlinkt, nie beschrieben
  | "infrastruktur"; // Server, Datenbanken, Automationsebene

export type Bereich =
  | "Zentrale"
  | "Vertrieb"
  | "Betrieb"
  | "Finanzen"
  | "Marketing"
  | "KI & Agenten"
  | "Infrastruktur";

export type Bedienung = { label: string; pfad: string; hinweis?: string };

export type AppEintrag = {
  id: string;
  name: string;
  kurz: string; // ein Satz: wofür ist das da
  bereich: Bereich;
  rolle: Rolle;
  repo?: string; // "HKGrowthOperator/<name>"
  url?: string; // Startadresse der laufenden App
  health?: string; // Pfad oder volle Adresse für den Erreichbarkeitstest
  bedienung?: Bedienung[]; // Direktsprünge in die App (Pfade relativ zu url)
  extern?: { label: string; url: string }[]; // feste Fremdadressen (Supabase, Meta …)
  betrieb?: string; // wie es läuft (Coolify, Dockerfile, Port …)
  stack?: string;
  // Kann die App Ereignisse ans Cockpit schicken? Dann mit welcher Signatur.
  ereignisse?: { kopf: "x-hk-signature" | "x-coldmail-signature"; arten: string[]; felder: string[]; einrichtung: string };
  status?: "aktiv" | "im-aufbau" | "geplant";
  hinweis?: string;
};

export const ORG = "HKGrowthOperator";

export const APPS: AppEintrag[] = [
  // ── Zentrale ──────────────────────────────────────────────────────────────
  {
    id: "cockpit",
    name: "HK Cockpit",
    kurz: "Die Zentrale: alle Apps, Status, Aktivität, Mail-Automation und Betrieb an einem Ort.",
    bereich: "Zentrale",
    rolle: "zentrale",
    repo: `${ORG}/HK-Cockpit`,
    health: "/api/zentrale/health",
    stack: "Next.js 16 · Postgres · n8n",
    betrieb: "Docker Compose (Postgres + Web), n8n separat",
    status: "aktiv",
  },

  // ── Eigenständig: nur verlinkt, Status gelesen, nie beschrieben ───────────
  {
    id: "sales-app-2",
    name: "Sales App 2.0 · DealUno",
    kurz: "Leads, Anrufe, Termine und CRM. Läuft eigenständig — das Cockpit liest nur den Status.",
    bereich: "Vertrieb",
    rolle: "eigenstaendig",
    repo: `${ORG}/Sales-App-2.0`,
    url: "https://salesapp2.hk-growthoperator.de",
    health: "/api/gesundheit",
    bedienung: [
      { label: "Anmelden", pfad: "/" },
      { label: "Buchungsseite Webseite", pfad: "/buchen/webseite", hinweis: "Terminlink der Website" },
    ],
    stack: "Next.js 15 · Supabase",
    betrieb: "Coolify · Dockerfile",
    status: "aktiv",
    hinweis: "Bleibt unabhängig. Keine Schreibzugriffe aus dem Cockpit.",
  },
  {
    id: "coldmail",
    name: "Coldmail",
    kurz: "Selbst gehostete Cold-Mail-App je Projekt und Produkt. Läuft eigenständig.",
    bereich: "Vertrieb",
    rolle: "eigenstaendig",
    repo: `${ORG}/Coldmail`,
    url: "https://coldmail.hk-growthoperator.de",
    health: "/healthz",
    bedienung: [{ label: "Heute", pfad: "/" }],
    stack: "Node 22 · SQLite",
    betrieb: "Coolify · Dockerfile · Port 3000",
    ereignisse: {
      kopf: "x-coldmail-signature",
      arten: ["reply.received", "lead.interested", "lead.meeting", "lead.unsubscribed", "lead.bounced", "campaign.completed", "opportunity.won", "account.triggered", "task.created"],
      felder: ["lead.email", "lead.salutation", "lead.first_name", "lead.last_name", "lead.company", "subject", "text"],
      einrichtung: "In Coldmail unter Einstellungen → Webhook: Adresse und Geheimnis eintragen, gewünschte Ereignisse anhaken.",
    },
    status: "aktiv",
    hinweis: "Bleibt unabhängig. Cold Mailing läuft nur hier, nie über das Cockpit.",
  },
  {
    id: "sales-app-1",
    name: "Sales App V1",
    kurz: "Die bisherige Sales App. Wird nicht mehr verändert, nur noch genutzt.",
    bereich: "Vertrieb",
    rolle: "eigenstaendig",
    url: "https://salesapp.hk-growthoperator.de",
    status: "aktiv",
    hinweis: "Bestand. Das Repo wird bewusst nicht angebunden.",
  },

  // ── Intern: Werkzeuge von HK für HK ───────────────────────────────────────
  {
    id: "hk-os",
    name: "HK OS · KI-Assistent",
    kurz: "Aufgaben, Kalender, Firmenwissen, Posteingang und persönlicher Assistent fürs Team.",
    bereich: "Betrieb",
    rolle: "intern",
    repo: `${ORG}/KI-Assistent`,
    url: "https://os.hk-growthoperator.de",
    health: "/api/health",
    bedienung: [
      { label: "Mein Tag", pfad: "/" },
      { label: "Aufgaben", pfad: "/aufgaben" },
      { label: "Kalender", pfad: "/kalender" },
      { label: "Wissen", pfad: "/wissen" },
      { label: "Posteingang", pfad: "/posteingang" },
    ],
    stack: "Next.js 16 · Supabase · Claude",
    betrieb: "Coolify · Dockerfile · Port 3000",
    status: "aktiv",
  },
  {
    id: "hk-kern",
    name: "HK Kern · Agenten-OS",
    kurz: "Datenzentrale „HK Data“ und Agenten-Arbeitsplatz mit Freigaben und Landkarte.",
    bereich: "KI & Agenten",
    rolle: "intern",
    repo: `${ORG}/hk-Kern`,
    url: "https://agenten.hk-growthoperator.de",
    bedienung: [
      { label: "Arbeitsplatz", pfad: "/" },
      { label: "Freigaben", pfad: "/freigaben", hinweis: "Vorschläge der Agenten entscheiden" },
      { label: "Landkarte", pfad: "/landkarte" },
      { label: "Verbindungen", pfad: "/einstellungen/verbindungen" },
    ],
    extern: [{ label: "Supabase „HK Data“", url: "https://supabase.com/dashboard/project/tttowspyibdaewmzaxya" }],
    stack: "Supabase (Postgres 17) · Edge Functions · Next.js",
    betrieb: "Coolify · Dockerfile im Wurzelverzeichnis",
    status: "aktiv",
  },
  {
    id: "finanz",
    name: "HK Growth Finance",
    kurz: "Finanz- und Buchhaltungs-OS: Rechnungen, Belege, offene Posten, Steuerberater-Export.",
    bereich: "Finanzen",
    rolle: "intern",
    repo: `${ORG}/Finanz`,
    stack: "Next.js 15 · Supabase",
    betrieb: "Coolify · Dockerfile",
    status: "im-aufbau",
    hinweis: "Adresse nach dem ersten Ausrollen hier eintragen.",
  },
  {
    id: "outbound-os",
    name: "HK Outbound OS",
    kurz: "Research-first Outbound: Firmen recherchieren, Process-Fit bewerten, Nachrichten zur Freigabe vorbereiten.",
    bereich: "Vertrieb",
    rolle: "intern",
    repo: `${ORG}/hk-outbound-os`,
    health: "/api/health",
    stack: "Next.js 15 · Supabase · Claude",
    betrieb: "Coolify · Dockerfile",
    status: "im-aufbau",
    hinweis: "Adresse nach dem Ausrollen eintragen.",
  },
  {
    id: "planungs-kalender",
    name: "Planungs-Kalender",
    kurz: "Gemeinsame Planung. Repository angelegt, noch ohne Inhalt.",
    bereich: "Betrieb",
    rolle: "intern",
    repo: `${ORG}/Planungs-Kalender`,
    status: "geplant",
  },
  {
    id: "agent-playbook",
    name: "Agent-Playbook",
    kurz: "Arbeitsregeln und Abläufe für die KI-Agenten von HK.",
    bereich: "KI & Agenten",
    rolle: "intern",
    repo: `${ORG}/HKGrowthOperator-Agent-Playbook`,
    status: "aktiv",
  },

  // ── Marketing: eigene Auftritte ──────────────────────────────────────────
  {
    id: "website",
    name: "HK Growth Website",
    kurz: "Hauptseite hk-growthoperator.de mit Prozess-Check, Demo- und ROI-Formular.",
    bereich: "Marketing",
    rolle: "intern",
    repo: `${ORG}/Website`,
    url: "https://hk-growthoperator.de",
    health: "/health",
    stack: "statisch + Node-Formularserver",
    betrieb: "Coolify · Dockerfile · Port 3000",
    status: "aktiv",
  },
  {
    id: "webstudio",
    name: "HK Growth Webstudio",
    kurz: "Vertriebsseite fürs Website-Angebot mit Terminbuchung, Anfrage-Bewertung und eigenem Admin.",
    bereich: "Marketing",
    rolle: "intern",
    repo: `${ORG}/WEBSEITE`,
    url: "https://website.hk-growthoperator.de",
    health: "/healthz",
    bedienung: [
      { label: "Startseite", pfad: "/" },
      { label: "Admin & Posteingang", pfad: "/admin" },
    ],
    stack: "Node (ohne Abhängigkeiten) · eigenes CMS",
    betrieb: "Coolify · Dockerfile · Port 3000 · Volume /app/data",
    ereignisse: {
      kopf: "x-hk-signature",
      arten: ["lead.created", "lead.test"],
      felder: ["name", "email", "company", "phone", "intent", "budget", "timeline", "preferredDate", "preferredSlot", "package", "message", "score"],
      einrichtung: "In Coolify bei WEBSEITE: LEAD_WEBHOOK_URL und LEAD_WEBHOOK_SECRET setzen, neu deployen.",
    },
    status: "aktiv",
  },
  {
    id: "webcheck",
    name: "HK Wachstums-Check",
    kurz: "Der Einstieg für Interessenten: Diagnose statt Verkaufsgespräch.",
    bereich: "Marketing",
    rolle: "intern",
    url: "https://webcheck.hk-growthoperator.de",
    status: "aktiv",
    hinweis: "Repository ist dem Cockpit noch nicht zugeordnet.",
  },
  {
    id: "ads",
    name: "HK Growth Ads",
    kurz: "Anzeigen-Kreative und Briefings für Meta (Videos v1–v4, Webcheck-Spots).",
    bereich: "Marketing",
    rolle: "intern",
    repo: `${ORG}/HKGrowth-ads`,
    extern: [{ label: "Meta Werbeanzeigenmanager", url: "https://adsmanager.facebook.com/" }],
    stack: "HyperFrames / Remotion",
    status: "aktiv",
  },

  // ── Eigene Produkte und Marken ───────────────────────────────────────────
  {
    id: "dealuno-website",
    name: "DealUno Website",
    kurz: "Marketing-Website von DealUno mit Produktseiten, Paketen und Vergleichsseiten.",
    bereich: "Marketing",
    rolle: "produkt",
    repo: `${ORG}/deal-Uno`,
    url: "https://dealuno.hk-growthoperator.de",
    stack: "statisch · Nginx",
    betrieb: "Coolify · Static /dist",
    status: "aktiv",
    hinweis: "Vorgänger-Repo DealUno-Website ist durch deal-Uno abgelöst.",
  },
  {
    id: "dealoperator",
    name: "Deal Operator",
    kurz: "Kostenfreie Community fürs gemeinsame Callen: Zahlen, Rangliste, Partner, Wissen.",
    bereich: "Vertrieb",
    rolle: "produkt",
    repo: `${ORG}/Dealoperator`,
    url: "https://dealoperator.hk-growthoperator.de",
    health: "/api/health",
    bedienung: [
      { label: "Rangliste", pfad: "/ranking" },
      { label: "Verwaltung", pfad: "/verwaltung" },
    ],
    stack: "Next.js 16 · Supabase",
    betrieb: "Coolify · Dockerfile",
    status: "aktiv",
  },
  {
    id: "auftrags-dashboard",
    name: "Auftrags-Dashboard",
    kurz: "Produktlinie „Intelligentes Auftrags- und Prozessdashboard“ — wird je Kunde eigenständig installiert.",
    bereich: "Betrieb",
    rolle: "produkt",
    repo: `${ORG}/Anfrage-dashboard`,
    stack: "Node 22 · node:sqlite",
    betrieb: "je Kunde eigener Container",
    status: "aktiv",
    hinweis: "Hier nur die Produktlinie. Kundeninstallationen gehören nicht ins Cockpit.",
  },

  // ── Infrastruktur ────────────────────────────────────────────────────────
  {
    id: "n8n",
    name: "n8n",
    kurz: "Automationsebene: führt die 31 HK-Automationen aus und meldet Läufe ans Cockpit.",
    bereich: "Infrastruktur",
    rolle: "infrastruktur",
    health: "/healthz",
    betrieb: "Coolify · eigenes Compose (n8n-standalone)",
    status: "aktiv",
    hinweis: "Adresse kommt aus N8N_PUBLIC_URL bzw. N8N_BASE_URL.",
  },
  {
    id: "backup-server",
    name: "Backup-Server",
    kurz: "Sicherungen der Server und Datenbanken.",
    bereich: "Infrastruktur",
    rolle: "infrastruktur",
    repo: `${ORG}/Backup-Server`,
    status: "aktiv",
  },
  {
    id: "coolify",
    name: "Coolify",
    kurz: "Hier laufen die Container aller HK-Apps.",
    bereich: "Infrastruktur",
    rolle: "infrastruktur",
    status: "aktiv",
    hinweis: "Adresse der Coolify-Oberfläche hier eintragen.",
  },
  {
    id: "github",
    name: "GitHub · HKGrowthOperator",
    kurz: "Alle Repositories der Organisation.",
    bereich: "Infrastruktur",
    rolle: "infrastruktur",
    url: "https://github.com/HKGrowthOperator",
    status: "aktiv",
  },
];

// Repositories, die zu Kunden gehören. Sie erscheinen nie im Cockpit.
export const KUNDEN_REPOS = [
  "CCRR-WEBSEITE", "Merzenich-Aktuell", "WebseiteMarelle", "Marelle-Studio", "Merzlicht",
  "Tamil", "KFZ-Oberberg", "-kfz-oberberg-werkstatt", "Fame-Caf-", "Living-Charity",
  "workspace-oberberg", "hemmersbach-gmbh", "melik-geruestbau", "Demo-Heim-PArtner", "GTTF",
];

// Eigene Repositories, die bewusst nicht angebunden werden.
export const ABGELEGT: Record<string, string> = {
  "Sales-App": "Sales App V1 — wird nur noch genutzt, nicht verändert",
  "HK-CockpitL": "ältere Datei-Kopie des Cockpits, abgelöst durch HK-Cockpit",
  "DealUno-Website": "abgelöst durch deal-Uno",
};

// Repositories, die noch keiner Seite sicher zugeordnet sind. Sie erscheinen
// unter „Noch einzuordnen“, bis jemand in der App entscheidet (oder hier).
export const UNENTSCHIEDEN = [
  "Hypescore", "Landigpageweb", "Work", "kunden-dashboard", "DEMO-DASHBOARD", "Luiskummer",
];

export const BEREICHE: Bereich[] = [
  "Zentrale", "Vertrieb", "Betrieb", "Finanzen", "Marketing", "KI & Agenten", "Infrastruktur",
];

export const ROLLEN_TEXT: Record<Rolle, string> = {
  zentrale: "Zentrale",
  intern: "Intern",
  produkt: "Eigenes Produkt",
  eigenstaendig: "Eigenständig",
  infrastruktur: "Infrastruktur",
};

export function findeApp(id: string): AppEintrag | undefined {
  return APPS.find((a) => a.id === id);
}

export function repoName(repo?: string): string | undefined {
  return repo?.split("/")[1];
}

// Vollständige Adresse eines Pfads (oder einer bereits vollen Adresse) bilden.
export function adresse(basis: string | undefined, pfad: string | undefined): string | undefined {
  if (!pfad) return undefined;
  if (/^https?:\/\//i.test(pfad)) return pfad;
  if (!basis) return undefined;
  return basis.replace(/\/+$/, "") + (pfad.startsWith("/") ? pfad : "/" + pfad);
}
