// Prüft die automatische Kontierung von Bankumsätzen — ohne Datenbank.
// Aufruf aus web/:  npm run test:auto-kontierung
//
// Abgedeckt: Richtung des Buchungssatzes, Regelgriffe je Lieferantentyp,
// Steuerschlüssel, Gesellschafter-Erkennung, Klärungskonto als Auffangnetz,
// Buchungstext und die Zusammenarbeit mit der Buchungsprüfung.
import { kontiereUmsatz, buchungstext, erkenneGesellschafter, REGELN } from "@/lib/accounting/auto-kontierung";
import { pruefeBuchung, steuerAusBrutto, formatCent } from "@/lib/accounting/buchen";
import { KONTENRAHMEN, STANDARDKONTEN } from "@/lib/accounting/kontenrahmen";
import type { Kontenrahmen } from "@/lib/accounting/types";

let fehler = 0;
const ok = (name: string, bedingung: boolean, info = "") => {
  console.log(`${bedingung ? "  OK  " : " FEHL "} ${name}${info ? " — " + info : ""}`);
  if (!bedingung) fehler++;
};

const GESELLSCHAFTER = ["Maximilian Beispiel", "Erika Musterfrau"];
const opt = (rahmen: Kontenrahmen = "SKR04") => ({ rahmen, gesellschafter: GESELLSCHAFTER });

/** Kürzel für einen Umsatz — spart Wiederholung in den Prüfungen. */
const umsatz = (betrag_cent: number, partner: string, verwendungszweck = "") =>
  ({ betrag_cent, partner, verwendungszweck });

console.log("\n── Richtung des Buchungssatzes ──");
{
  const bank = STANDARDKONTEN.SKR04.bank;
  const ein = kontiereUmsatz(umsatz(207655, "Beispiel e.V.", "RE20260036"), opt());
  ok("Eingang: Bank im Soll", ein.soll_konto === bank, `${ein.soll_konto}/${ein.haben_konto}`);
  ok("Eingang: Erlöse im Haben", ein.haben_konto === "4400", ein.haben_konto);

  const aus = kontiereUmsatz(umsatz(-4415, "Hetzner Online GmbH", "Kundennummer K073"), opt());
  ok("Ausgang: Bank im Haben", aus.haben_konto === bank, `${aus.soll_konto}/${aus.haben_konto}`);
  ok("Ausgang: Aufwand im Soll", aus.soll_konto === "6470", aus.soll_konto);

  // Eine Rückbuchung trägt dieselbe Regel, nur andersherum — damit hebt sie
  // die ursprüngliche Buchung exakt auf.
  const rueck = kontiereUmsatz(umsatz(4415, "Hetzner Online GmbH", "Kundennummer K073"), opt());
  ok("Rückbuchung dreht den Satz um",
    rueck.soll_konto === aus.haben_konto && rueck.haben_konto === aus.soll_konto,
    `${rueck.soll_konto}/${rueck.haben_konto}`);
}

console.log("\n── Regeln je Lieferantentyp ──");
{
  const faelle: Array<[string, number, string, string, string, string]> = [
    // [Titel, Betrag in Cent, Partner, Zweck, erwartetes Gegenkonto, erwarteter Steuerschlüssel]
    ["Hosting", -4415, "Hetzner Online GmbH", "Rechnung", "6470", "19"],
    ["Software", -29999, "APPLE.COM.BILL", "Abo", "6837", "19"],
    ["Software (KI-Abo)", -2299, "beispiel", "ChatGPT Abo für die Firma", "6837", "19"],
    ["Telefon", -1500, "HB-Handy-Laden", "Mobilfunknummer Telekom", "6805", "19"],
    ["Notar", -83956, "Notare Weyland u. Partner", "Gründung", "6825", "19"],
    ["Justizkasse ohne USt", -30000, "Zentrale Zahlstelle Justiz", "X73220", "6825", "0"],
    ["Bankentgelt", -3316, "", "Abrechnung 31.08.2026 siehe Anlage Nr. 2", "6855", "19"],
    ["Rücklastschrift-Entgelt", -232, "", "Rückgabe Lastschrift über 44,15 EUR", "6855", "19"],
    ["Bargeld", 34000, "", "SB-EINZAHLUNG STROMBACH GA 2210", "1460", "0"],
    ["Stammkapital", 100000, "Erika Muster", "Stammkapital Einzahlung", "2000", "0"],
  ];
  for (const [titel, betrag, partner, zweck, konto, steuer] of faelle) {
    const k = kontiereUmsatz(umsatz(betrag, partner, zweck), opt());
    ok(`${titel} → ${konto}`, k.gegenkonto === konto, `${k.gegenkonto} (Regel ${k.regel})`);
    ok(`${titel}: Steuerschlüssel ${steuer}`, k.steuerschluessel === steuer, k.steuerschluessel);
  }
}

console.log("\n── Konsumnahe Kartenzahlung ──");
{
  const k = kontiereUmsatz(umsatz(-1075, "ALDI SAGT DANKE 02 031", "Kartenzahlung"), opt());
  ok("Supermarkt → Gesellschafterkonto", k.gegenkonto === "2100", k.gegenkonto);
  ok("Supermarkt ist zu prüfen", k.konfidenz === "zu_pruefen", k.konfidenz);
  ok("Supermarkt ohne Vorsteuer", k.steuerschluessel === "0", k.steuerschluessel);

  // Eingänge sind davon nicht betroffen — die Regel greift nur nach unten.
  const ein = kontiereUmsatz(umsatz(2500, "REWE SAGT DANKE", "Erstattung"), opt());
  ok("Erstattung vom Händler fällt nicht unter Konsum", ein.regel !== "konsum", ein.regel);
}

console.log("\n── Gesellschafter ──");
{
  const k = kontiereUmsatz(umsatz(-15000, "MAXIMILIAN BEISPIEL", "DATUM 11.07.2026, 20.19 UHR"), opt());
  ok("Auszahlung an Gesellschafter → 2100", k.gegenkonto === "2100", k.gegenkonto);
  ok("Gesellschafter ist zu prüfen", k.konfidenz === "zu_pruefen", k.konfidenz);

  const fremd = kontiereUmsatz(umsatz(-15000, "Irgendwer GmbH", "Zahlung"), opt());
  ok("Fremder landet nicht auf 2100", fremd.gegenkonto !== "2100", fremd.gegenkonto);

  // Ein einzelner Vorname reicht nicht — sonst trifft "Max" jede Maxi GmbH.
  const halb = kontiereUmsatz(umsatz(-100, "Beispiel Logistik GmbH", ""), opt());
  ok("Teiltreffer im Namen genügt nicht", halb.gegenkonto !== "2100", halb.gegenkonto);

  // Dieselbe Person, kürzer geschrieben — die Bank ist da nicht konsequent.
  const kurz = kontiereUmsatz(umsatz(-2500, "maximilian beispiel", ""), opt());
  ok("Kurzform desselben Namens trifft", kurz.gegenkonto === "2100", kurz.gegenkonto);
}

console.log("\n── Gesellschafter aus den Umsätzen erkennen ──");
{
  const namen = erkenneGesellschafter([
    umsatz(100000, "LUIS BEISPIEL KUMMER", "Stammkapital Einzahlung"),
    umsatz(100000, "", "STAMMKAPITAL NICK MUSTERMANN"),
    umsatz(-1075, "ALDI SAGT DANKE", "Kartenzahlung"),
  ]);
  ok("beide Einzahler erkannt", namen.length === 2, namen.join(" / "));
  ok("Name aus dem Partnerfeld",
    namen.some((n) => n.toLowerCase().includes("kummer")), namen.join(" / "));
  ok("Name aus dem Verwendungszweck",
    namen.some((n) => n.toLowerCase().includes("mustermann")), namen.join(" / "));
  ok("Stichwort landet nicht im Namen",
    !namen.join(" ").toLowerCase().includes("stammkapital"), namen.join(" / "));

  // Und damit greift die Zuordnung auch bei der späteren Auszahlung.
  const spaeter = kontiereUmsatz(umsatz(-5000, "NICK MUSTERMANN", "Auszahlung"),
    { rahmen: "SKR04", gesellschafter: namen });
  ok("Auszahlung an erkannten Gesellschafter → 2100", spaeter.gegenkonto === "2100", spaeter.gegenkonto);
}

console.log("\n── Klärungskonto als Auffangnetz ──");
{
  const k = kontiereUmsatz(umsatz(-160000, "WHOP.AKQUISE INTERNATI", "Bartycka 22 New York PL"), opt());
  ok("Unbekannter Posten → 1590", k.gegenkonto === "1590", k.gegenkonto);
  ok("Unbekannter Posten ist zu prüfen", k.konfidenz === "zu_pruefen", k.konfidenz);
  ok("Unbekannter Posten ohne Steuer", k.steuerschluessel === "0", k.steuerschluessel);
  ok("1590 existiert in SKR04",
    KONTENRAHMEN.SKR04.some((konto) => konto.nummer === "1590"));
  ok("1590 existiert in SKR03",
    KONTENRAHMEN.SKR03.some((konto) => konto.nummer === "1590"));
  ok("1590 zählt nicht in die GuV",
    KONTENRAHMEN.SKR04.find((konto) => konto.nummer === "1590")?.guv === false);
}

console.log("\n── Beide Kontenrahmen ──");
{
  const s3 = kontiereUmsatz(umsatz(-4415, "Hetzner Online GmbH", ""), opt("SKR03"));
  ok("SKR03: Hosting → 4960", s3.gegenkonto === "4960", s3.gegenkonto);
  ok("SKR03: Bank im Haben", s3.haben_konto === "1200", s3.haben_konto);

  // Jedes Konto aus den Regeln muss im jeweiligen Rahmen wirklich vorhanden
  // sein, sonst scheitert die Buchung erst zur Laufzeit.
  for (const rahmen of ["SKR03", "SKR04"] as const) {
    const nummern = new Set(KONTENRAHMEN[rahmen].map((k) => k.nummer));
    const unbekannt = REGELN
      .map((r) => kontiereUmsatz(umsatz(-100, "", beispieltext(r.id)), opt(rahmen)).gegenkonto)
      .filter((nummer) => !nummern.has(nummer));
    ok(`${rahmen}: alle Regelkonten existieren`, unbekannt.length === 0, unbekannt.join(", "));
  }
}

/** Liefert zu einer Regel-id einen Text, der genau diese Regel auslöst. */
function beispieltext(id: string): string {
  const proben: Record<string, string> = {
    stammkapital: "Stammkapital Einzahlung",
    bankentgelt: "Abrechnung 31.08.2026",
    bargeld: "Bargeldeinzahlung",
    hosting: "Hetzner",
    software: "apple.com",
    telefon: "Telekom",
    notar: "Notar",
    justizkasse: "Justiz",
    steuerberatung: "Steuerberatung",
    werbung: "Google Ads",
    "erloes-rechnungsnummer": "RE-2026-0007",
    konsum: "ALDI",
  };
  return proben[id] ?? "";
}

console.log("\n── Buchungstext ──");
{
  ok("Partner und Zweck werden verbunden",
    buchungstext({ partner: "Hetzner Online GmbH", verwendungszweck: "Rechnung 084" })
      === "Hetzner Online GmbH — Rechnung 084");
  ok("Leerer Umsatz bekommt einen Text",
    buchungstext({ partner: null, verwendungszweck: null }) === "Bankumsatz ohne Angabe");
  const lang = buchungstext({ partner: "A".repeat(200), verwendungszweck: "B".repeat(200) });
  ok("Langer Text wird gekürzt", lang.length === 160, `${lang.length} Zeichen`);
}

console.log("\n── Zusammenspiel mit der Buchungsprüfung ──");
{
  const konten = new Map(KONTENRAHMEN.SKR04.map((k) => [k.nummer, k]));
  const faelle = [
    umsatz(207655, "Beispiel e.V.", "RE20260036"),
    umsatz(-4415, "Hetzner Online GmbH", "Rechnung"),
    umsatz(-1075, "ALDI SAGT DANKE", "Kartenzahlung"),
    umsatz(-160000, "Unbekannt XY", "irgendwas"),
    umsatz(34000, "", "SB-EINZAHLUNG"),
  ];
  let alleGueltig = true;
  for (const u of faelle) {
    const k = kontiereUmsatz(u, opt());
    const pruefung = pruefeBuchung({
      datum: "2026-08-12",
      buchungstext: k.buchungstext,
      betrag: Math.abs(u.betrag_cent) / 100,
      steuerschluessel: k.steuerschluessel,
      soll_konto: k.soll_konto,
      haben_konto: k.haben_konto,
    }, konten);
    if (!pruefung.ok) {
      alleGueltig = false;
      console.log(`       ${k.buchungstext}: ${pruefung.fehler.join(" ")}`);
    }
  }
  ok("Jeder Vorschlag ist eine gültige Buchung", alleGueltig);

  // Der Steuerbetrag muss zum Bruttobetrag passen — 13,55 € mit 19 % ergeben
  // laut Kontoauszug 2,16 € Umsatzsteuer.
  const entgelt = kontiereUmsatz(umsatz(-1355, "", "Abrechnung 30.06.2026"), opt());
  const steuer = steuerAusBrutto(1355, entgelt.steuerschluessel);
  ok("Bankentgelt: Steuer stimmt mit dem Auszug", steuer === 216, formatCent(steuer));
}

console.log(`\n${fehler === 0 ? "Alle Prüfungen bestanden." : `${fehler} Prüfung(en) fehlgeschlagen.`}\n`);
process.exit(fehler === 0 ? 0 : 1);
