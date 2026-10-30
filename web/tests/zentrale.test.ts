// Prüft die Zentrale ohne Datenbank und ohne Netz: Register, Vorlagen,
// Versandentscheidung, Signaturen, Verschlüsselung, Erreichbarkeitsbewertung.
import { APPS, KUNDEN_REPOS, ABGELEGT, UNENTSCHIEDEN, BEREICHE, adresse, repoName } from "@/lib/zentrale/register";
import { WERKZEUGE } from "@/lib/zentrale/werkzeuge";
import { fuelle, platzhalter, vorlagenHash, istFreigegeben, gueltigeAdresse, entscheide, mitSignatur, einzeilig } from "@/lib/zentrale/mail/vorlage";
import { signieren, signaturGueltig, verschluesseln, entschluesseln } from "@/lib/zentrale/krypto";
import { bewerte, istInternesNetz } from "@/lib/zentrale/health";
import { titelFuer } from "@/lib/zentrale/ereignisse";
import { ZENTRALE_SQL } from "@/lib/zentrale/schema";
import { readFileSync } from "node:fs";

let fehler = 0;
const ok = (name: string, b: boolean, info = "") => {
  console.log(`${b ? "  OK  " : " FEHL "} ${name}${info ? " — " + info : ""}`);
  if (!b) fehler++;
};

console.log("\n── Register ──");
const ids = APPS.map((a) => a.id);
ok("Kennungen eindeutig", new Set(ids).size === ids.length);
ok("Kennungen URL-tauglich", ids.every((i) => /^[a-z0-9-]+$/.test(i)));
const repos = APPS.map((a) => repoName(a.repo)).filter(Boolean) as string[];
ok("Repos eindeutig", new Set(repos).size === repos.length);
ok("kein Kundenrepo im Register", !repos.some((r) => KUNDEN_REPOS.includes(r)), repos.filter((r) => KUNDEN_REPOS.includes(r)).join(","));
ok("kein Werkzeug im Register", !repos.some((r) => WERKZEUGE.some((w) => w.repo === r)));
ok("kein abgelegtes Repo im Register", !repos.some((r) => r in ABGELEGT));
ok("Unentschiedene nicht im Register", !repos.some((r) => UNENTSCHIEDEN.includes(r)));
ok("Sales App 2.0 ist eigenständig", APPS.find((a) => a.repo?.endsWith("/Sales-App-2.0"))?.rolle === "eigenstaendig");
ok("Coldmail ist eigenständig", APPS.find((a) => a.repo?.endsWith("/Coldmail"))?.rolle === "eigenstaendig");
ok("genau eine Zentrale", APPS.filter((a) => a.rolle === "zentrale").length === 1);
ok("Bereiche gültig", APPS.every((a) => BEREICHE.includes(a.bereich)));
ok("Adressen https", APPS.every((a) => !a.url || a.url.startsWith("https://")));
ok("Bedienung nur mit Adresse", APPS.every((a) => !a.bedienung?.length || a.url));
ok("Ereignis-Apps kennen ihre Signatur", APPS.filter((a) => a.ereignisse).every((a) => /^x-[a-z-]+-signature$/.test(a.ereignisse!.kopf)));
ok("adresse(): Pfad an Basis", adresse("https://a.de/", "/x") === "https://a.de/x");
ok("adresse(): volle Adresse bleibt", adresse("https://a.de", "https://b.de/h") === "https://b.de/h");
ok("adresse(): ohne Basis nichts", adresse(undefined, "/x") === undefined);

console.log("\n── Vorlagen ──");
const f = fuelle("Hallo {{name}}, {{ firma | eure Firma }} — {{daten.paket}} {{fehlt}}", { name: "Nick", daten: { paket: "Onepager" } });
ok("Platzhalter gefüllt", f.text === "Hallo Nick, eure Firma — Onepager ", JSON.stringify(f.text));
ok("fehlender Wert gemeldet", f.fehlend.join() === "fehlt");
ok("Objekt ist kein Wert", fuelle("{{daten}}", { daten: { a: 1 } }).fehlend[0] === "daten");
ok("Platzhalter gefunden", platzhalter("{{a}} {{ b | x }} {{a}}").join() === "a,b");
const h = vorlagenHash("Betreff", "Text");
ok("Freigabe gilt für gleiche Fassung", istFreigegeben({ betreff: "Betreff", text: "Text", freigabe_hash: h }));
ok("Änderung hebt Freigabe auf", !istFreigegeben({ betreff: "Betreff", text: "Text!", freigabe_hash: h }));
ok("ohne Freigabe nicht freigegeben", !istFreigegeben({ betreff: "Betreff", text: "Text", freigabe_hash: null }));
ok("Adresse gültig", gueltigeAdresse("info@hk-growthoperator.de"));
ok("zwei Adressen abgelehnt", !gueltigeAdresse("a@b.de, c@d.de"));
ok("Zeilenumbruch abgelehnt", !gueltigeAdresse("a@b.de\nBcc: x@y.de"));
ok("einzeilig entfernt Umbrüche", einzeilig("Betreff\r\nBcc: x") === "Betreff Bcc: x");
ok("Signatur einmal", mitSignatur(mitSignatur("Hallo", "Gruß"), "Gruß") === "Hallo\n\nGruß");

console.log("\n── Versandentscheidung ──");
const basis = { modus: "automatisch" as const, vorlageFreigegeben: true, empfaenger: "kunde@firma.de", fehlend: [], ausEigenstaendigerApp: false, absenderAdresse: "info@hk-growthoperator.de" };
ok("alles erfüllt → automatisch", entscheide(basis).status === "freigegeben");
ok("Regel verlangt Freigabe → wartet", entscheide({ ...basis, modus: "freigabe" }).status === "wartet");
ok("Vorlage nicht freigegeben → wartet", entscheide({ ...basis, vorlageFreigegeben: false }).status === "wartet");
ok("leerer Platzhalter → wartet", entscheide({ ...basis, fehlend: ["name"] }).status === "wartet");
ok("ohne Empfänger → Entwurf", entscheide({ ...basis, empfaenger: "" }).status === "entwurf");
ok("ohne Postfach → Entwurf", entscheide({ ...basis, absenderAdresse: null }).status === "entwurf");
ok("eigenständige App → nicht nach außen", entscheide({ ...basis, ausEigenstaendigerApp: true }).status === "entwurf");
ok("eigenständige App → intern erlaubt", entscheide({ ...basis, ausEigenstaendigerApp: true, empfaenger: "team@hk-growthoperator.de" }).status === "freigegeben");

console.log("\n── Signatur & Verschlüsselung ──");
const body = JSON.stringify({ event: "lead.created", data: { name: "Test" } });
const sig = signieren(body, "geheim");
ok("Format sha256=…", /^sha256=[0-9a-f]{64}$/.test(sig));
ok("richtige Signatur gilt", signaturGueltig(body, "geheim", sig));
ok("falsches Geheimnis abgelehnt", !signaturGueltig(body, "anders", sig));
ok("veränderter Inhalt abgelehnt", !signaturGueltig(body + " ", "geheim", sig));
ok("fehlender Kopf abgelehnt", !signaturGueltig(body, "geheim", null));
const enc = verschluesseln("smtp-passwort");
ok("verschlüsselt nicht im Klartext", !enc.includes("smtp-passwort"));
ok("Rundweg", entschluesseln(enc) === "smtp-passwort");
ok("jedes Mal anders (IV)", verschluesseln("x") !== verschluesseln("x"));
let manipuliert = false;
try { entschluesseln(enc.slice(0, -4) + "AAAA"); } catch { manipuliert = true; }
ok("Manipulation erkannt", manipuliert);

console.log("\n── Erreichbarkeit ──");
ok("200 schnell → ok", bewerte(200, 120) === "ok");
ok("200 langsam → langsam", bewerte(200, 2500) === "langsam");
ok("302 → ok", bewerte(302, 100) === "ok");
ok("401 → läuft (geschützt)", bewerte(401, 100) === "ok");
ok("404 → gestört", bewerte(404, 100) === "gestoert");
ok("503 → gestört", bewerte(503, 100) === "gestoert");
ok("keine Antwort", bewerte(undefined, undefined) === "nicht-erreichbar");
ok("127.0.0.1 intern", istInternesNetz("127.0.0.1"));
ok("10.x intern", istInternesNetz("10.1.2.3"));
ok("172.20.x intern", istInternesNetz("172.20.0.5"));
ok("192.168.x intern", istInternesNetz("192.168.1.1"));
ok("169.254 (Metadaten) intern", istInternesNetz("169.254.169.254"));
ok("::1 intern", istInternesNetz("::1"));
ok("::ffff:10.0.0.1 intern", istInternesNetz("::ffff:10.0.0.1"));
ok("öffentliche Adresse erlaubt", !istInternesNetz("142.132.1.1"));

console.log("\n── Ereignis-Titel ──");
ok("Website-Anfrage", titelFuer("lead.created", { name: "Anna", company: "Muster GmbH" }) === "Neue Website-Anfrage: Anna (Muster GmbH)");
ok("Coldmail-Kontakt", titelFuer("lead.meeting", { lead: { first_name: "Jan", last_name: "Ott", company: "Ott KG" } }) === "Termin gebucht: Jan Ott (Ott KG)");
ok("nur E-Mail", titelFuer("reply.received", { lead: { email: "a@b.de" } }) === "Antwort von a@b.de");
ok("unbekannte Art lesbar", titelFuer("foo.bar_baz", {}) === "foo bar baz");

console.log("\n── Schema ──");
ok("db/init/04 entspricht schema.ts", readFileSync("../db/init/04-zentrale.sql", "utf8").includes(ZENTRALE_SQL));

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
