// lib/data/customer-service.ts — echte HK-Kunden und HK-Vertriebs-/Akquise-Vorlagen.
// Quelle: HK-Drive (Kunden-Ordner, „HK Angebotsvorlagen & Preisanker", Sales-System).
import type { Client, Template } from "./types";

export const clients: Client[] = [
  { id: "cli-oldrocket", name: "Old Rocket", contact: "", status: "aktiv", since: "2026", notes: "Website-Kunde. Detailliertes Website-Konzept v2 erstellt (siehe Drive › Kunden › Old Rocket).", tags: ["website", "kunde"] },
  { id: "cli-tamil", name: "Tamil.de", contact: "", status: "aktiv", since: "2026", notes: "Premium-Website. Angebot v13 inkl. Mobile-Fixes (siehe Drive).", tags: ["premium-website", "kunde"] },
  { id: "cli-kbs", name: "KBS Management", contact: "", status: "aktiv", since: "2026", notes: "Kundenordner in Drive › Kunden › KBS Management.", tags: ["kunde"] },
];

export const templates: Template[] = [
  { id: "tpl-wachstumscheck", title: "Einladung zum HK Wachstums-Check", channel: "E-Mail", category: "Akquise", body: "Hallo {{Name}},\n\nmir ist {{Unternehmen}} aufgefallen — ihr macht offensichtlich gute Arbeit, online zeigt sich das aus meiner Sicht aber noch nicht stark genug.\n\nWir bei HK machen dazu einen kurzen, unverbindlichen Wachstums-Check: Wir schauen auf Website & Anfrageweg, Positionierung, Sichtbarkeit und Prozesse — und sagen euch klar, wo der größte Hebel liegt. Kein Verkaufsgespräch, eine Diagnose.\n\nPasst dafür ein 15-Minuten-Call am {{Datum}}?\n\nBeste Grüße\n{{AbsenderIn}} · HK Growth Operator" },
  { id: "tpl-angebot-einstieg", title: "Angebots-Einstieg (im Gespräch)", channel: "Chat", category: "Vertrieb", body: "Ich habe das Angebot so aufgebaut, dass es nicht einfach eine Liste an Leistungen ist, sondern genau auf den Engpass einzahlt, den wir im Gespräch herausgearbeitet haben." },
  { id: "tpl-3monats", title: "3-Monats-Einstieg erklären", channel: "E-Mail", category: "Vertrieb", body: "Hallo {{Name}},\n\ndie ersten 3 Monate sind bei uns die Aufbau- und Testphase: In dieser Zeit bauen wir Fundament, Rhythmus und erste Marktsignale auf. Danach entscheiden wir gemeinsam, welche Ausbaustufe sinnvoll ist (längere Laufzeit, mehr Content, Ads, Website, Recruiting …).\n\nKein Wir-probieren-mal — eine strukturierte Aufbauphase mit klarer Optimierungsentscheidung danach.\n\nBeste Grüße\n{{AbsenderIn}}" },
  { id: "tpl-nachfass-check", title: "Nachfass nach Wachstums-Check", channel: "E-Mail", category: "Vertrieb", body: "Hallo {{Name}},\n\ndanke für das Gespräch! Wie besprochen sehe ich euren größten Hebel bei {{Hebel}}. Ich habe euch dazu eine konkrete Empfehlung zusammengestellt: {{Anlage}}.\n\nPasst ein kurzer Folgetermin am {{Datum}}, um es gemeinsam durchzugehen?\n\nBeste Grüße\n{{AbsenderIn}}" },
  { id: "tpl-warum-website-vor-ads", title: "Warum Website vor Ads", channel: "E-Mail", category: "Vertrieb", body: "Hallo {{Name}},\n\nkurz zu eurer Ads-Idee: Ads erzeugen Reichweite — aber wenn Website, Landingpage oder Anfrageweg nicht überzeugen, verbrennt man Budget. Deshalb prüfen wir zuerst: Ist das Angebot klar? Baut die Seite Vertrauen auf? Gibt es einen klaren CTA und genug Proof?\n\nWenn das Fundament steht, werden Ads richtig sinnvoll. Genau das schauen wir uns im Wachstums-Check an.\n\nBeste Grüße\n{{AbsenderIn}}" },
];
