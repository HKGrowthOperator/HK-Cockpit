// lib/accounting/auto-kontierung.ts — schlaegt zu einem Bankumsatz den
// Buchungssatz vor. Reine Logik, keine Datenbank: laeuft im Browser wie im
// Server und ist ohne Postgres testbar.
//
// Grundgedanke: Jeder Umsatz wird gebucht, keiner bleibt liegen. Was die Regeln
// nicht sicher zuordnen koennen, landet bewusst auf dem Klaerungskonto 1590
// statt auf einem geratenen Aufwandskonto — falsch kontierter Aufwand verzerrt
// die GuV still, ein Posten auf 1590 faellt beim Durchsehen sofort auf.

import type { BankUmsatz, Kontenrahmen, Steuerschluessel } from "./types";
import { STANDARDKONTEN } from "./kontenrahmen";

/** Wie sicher die Regel ist, die gegriffen hat. */
export type Konfidenz = "hoch" | "mittel" | "zu_pruefen";

/** Konten werden ueber einen Sachbegriff angesprochen, nicht ueber die Nummer —
 *  so gelten dieselben Regeln fuer SKR03 und SKR04. */
type KontoSchluessel =
  | "eigenkapital" | "gesellschafter" | "geldtransit" | "klaerung"
  | "erloese19" | "fremdleistung" | "gehalt" | "werbung" | "software"
  | "hosting" | "telefon" | "beratung" | "bankgebuehren" | "bewirtung"
  | "kfz" | "buerobedarf" | "betriebsbedarf";

const KONTO: Record<Kontenrahmen, Record<KontoSchluessel, string>> = {
  SKR03: {
    eigenkapital: "0800", gesellschafter: "1800", geldtransit: "1360", klaerung: "1590",
    erloese19: "8400", fremdleistung: "3100", gehalt: "4120", werbung: "4600",
    software: "4965", hosting: "4960", telefon: "4920", beratung: "4950",
    bankgebuehren: "4970", bewirtung: "4650", kfz: "4530", buerobedarf: "4930",
    betriebsbedarf: "4980",
  },
  SKR04: {
    eigenkapital: "2000", gesellschafter: "2100", geldtransit: "1460", klaerung: "1590",
    erloese19: "4400", fremdleistung: "5900", gehalt: "6020", werbung: "6600",
    software: "6837", hosting: "6470", telefon: "6805", beratung: "6825",
    bankgebuehren: "6855", bewirtung: "6640", kfz: "6530", buerobedarf: "6815",
    betriebsbedarf: "6300",
  },
};

export type Regel = {
  /** Kurzname, erscheint im Bericht — damit nachvollziehbar bleibt, warum
   *  ein Umsatz dort gelandet ist, wo er gelandet ist. */
  id: string;
  /** Nur pruefen, wenn der Umsatz in diese Richtung geht. */
  richtung?: "eingang" | "ausgang";
  /** Geprueft wird gegen "partner + verwendungszweck", klein geschrieben. */
  muster: RegExp;
  konto: KontoSchluessel;
  steuer: Steuerschluessel;
  konfidenz: Konfidenz;
};

// Reihenfolge entscheidet: die erste passende Regel gewinnt. Spezielles steht
// deshalb oben, Allgemeines unten.
export const REGELN: Regel[] = [
  // ── Kapital und Gesellschafter ────────────────────────────────────────────
  { id: "stammkapital", richtung: "eingang", muster: /stammkapital|einlage/,
    konto: "eigenkapital", steuer: "0", konfidenz: "hoch" },

  // ── Bank und Bargeld ──────────────────────────────────────────────────────
  { id: "bankentgelt", muster: /abrechnung \d{2}\.\d{2}\.|rückgabe lastschrift|entgelt/,
    konto: "bankgebuehren", steuer: "19", konfidenz: "hoch" },
  // Achtung: die Buchungsart ("SB-Bargeldeinzahlung") speichert der CSV-Import
  // nicht — geprueft werden kann nur, was in Partner und Zweck ankommt.
  { id: "bargeld", muster: /bargeldeinzahlung|bargeldausz|sb-einzahlung|geldautomat|\bga\s?nr|^storno/,
    konto: "geldtransit", steuer: "0", konfidenz: "hoch" },

  // ── Wiederkehrende Lieferanten ────────────────────────────────────────────
  { id: "hosting", muster: /hetzner|neue medien münnich|all-inkl|ionos|strato|netcup/,
    konto: "hosting", steuer: "19", konfidenz: "hoch" },
  { id: "software", muster: /apple\.com|chatgpt|openai|anthropic|adobe|microsoft|google (workspace|cloud)|notion|figma|slack/,
    konto: "software", steuer: "19", konfidenz: "hoch" },
  { id: "telefon", muster: /telekom|vodafone|o2|prepaidhandy|mobilfunk/,
    konto: "telefon", steuer: "19", konfidenz: "hoch" },
  { id: "notar", muster: /notar/,
    konto: "beratung", steuer: "19", konfidenz: "hoch" },
  // Gerichts- und Justizkassen rechnen ohne Umsatzsteuer ab.
  { id: "justizkasse", muster: /justiz|amtsgericht|handelsregister|gerichtskasse/,
    konto: "beratung", steuer: "0", konfidenz: "hoch" },
  { id: "steuerberatung", muster: /steuerberat|datev|buchführung/,
    konto: "beratung", steuer: "19", konfidenz: "hoch" },
  { id: "werbung", muster: /meta platforms|facebook|google ads|linkedin|tiktok ads/,
    konto: "werbung", steuer: "19", konfidenz: "hoch" },

  // ── Erloese ───────────────────────────────────────────────────────────────
  // Eingang mit Rechnungsnummer im Verwendungszweck ist ein Kundenumsatz.
  { id: "erloes-rechnungsnummer", richtung: "eingang", muster: /\bre[-\s]?\d{4,}|rechnung(s)?[-\s]?nr|\brg\d{4,}/,
    konto: "erloese19", steuer: "19", konfidenz: "mittel" },

  // ── Konsumnahe Kartenzahlungen ────────────────────────────────────────────
  // Supermarkt, Tankstelle, Tabak, Gastronomie: bei einer UG ist das im
  // Zweifel keine Betriebsausgabe. Auf das Gesellschafterkonto, damit die GuV
  // sauber bleibt — die Kanzlei entscheidet ueber die Umbuchung.
  { id: "konsum", richtung: "ausgang",
    muster: /aldi|rewe|lidl|edeka|penny|netto|kaufland|tabak|tobaccoland|backwerk|bäckerei|conditorei|café|cafe |restaurant|gastro|systemgastronomie|jaeger|jäger|wasserski|aral|jet dankt|shell|esso|total |apcoa|parking|parkhaus/,
    konto: "gesellschafter", steuer: "0", konfidenz: "zu_pruefen" },
];

export type Kontierung = {
  soll_konto: string;
  haben_konto: string;
  /** Das Konto gegenueber der Bank — das ist die eigentliche Aussage. */
  gegenkonto: string;
  steuerschluessel: Steuerschluessel;
  buchungstext: string;
  konfidenz: Konfidenz;
  /** id der Regel, die gegriffen hat, oder "gesellschafter" / "klaerung". */
  regel: string;
};

/** Baut den Text, der spaeter im Journal und im DATEV-Export steht. */
export function buchungstext(u: Pick<BankUmsatz, "partner" | "verwendungszweck">): string {
  const teile = [u.partner?.trim(), u.verwendungszweck?.trim()].filter(Boolean) as string[];
  const text = teile.join(" — ").replace(/\s+/g, " ").trim();
  if (!text) return "Bankumsatz ohne Angabe";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/** Aussagekräftige Namensteile — kurze Wörter wie "van" oder "Dr" trennen nicht. */
function namensteile(name: string): string[] {
  return name.toLowerCase().split(/[\s,.]+/).filter((w) => w.length >= 4);
}

/**
 * Erkennt Zahlungen an die eigenen Gesellschafter.
 *
 * Banken schreiben denselben Menschen unterschiedlich — mal "LUIS EMILIO
 * KUMMER", mal "luis kummer". Deshalb müssen nicht alle Namensteile passen,
 * sondern zwei. Bei einnamigen Einträgen genügt dieser eine, sonst würde die
 * Regel nie greifen.
 */
function istGesellschafter(text: string, gesellschafter: string[]): boolean {
  return gesellschafter.some((name) => {
    const worte = namensteile(name);
    if (worte.length === 0) return false;
    const treffer = worte.filter((w) => text.includes(w)).length;
    return treffer >= Math.min(2, worte.length);
  });
}

/**
 * Liest die Gesellschafter aus den Umsätzen selbst: Wer Stammkapital einzahlt,
 * ist Gesellschafter. Damit muss niemand eine Namensliste pflegen, und die
 * Erkennung stimmt auch dann, wenn sich die Beteiligungen später ändern.
 */
export function erkenneGesellschafter(
  umsaetze: Array<Pick<BankUmsatz, "partner" | "verwendungszweck">>,
): string[] {
  const kapitalregel = REGELN.find((r) => r.id === "stammkapital");
  if (!kapitalregel) return [];

  const gefunden = new Map<string, string>();
  for (const u of umsaetze) {
    const text = `${u.partner ?? ""} ${u.verwendungszweck ?? ""}`.toLowerCase();
    if (!kapitalregel.muster.test(text)) continue;

    // Der Name steht entweder im Partnerfeld oder im Verwendungszweck neben
    // dem Stichwort ("STAMMKAPITAL NICK HINZE").
    const roh = u.partner?.trim()
      || (u.verwendungszweck ?? "").replace(/stammkapital|einzahlung|einlage|kapital/gi, " ");
    const name = roh.split(/[\s,.]+/).filter((w) => /^[a-zäöüß-]{2,}$/i.test(w)).slice(0, 4).join(" ");
    if (namensteile(name).length > 0) gefunden.set(name.toLowerCase(), name);
  }
  return [...gefunden.values()];
}

export type KontierungsOptionen = {
  rahmen: Kontenrahmen;
  /** Namen der Gesellschafter — Zahlungen an sie gehen aufs Gesellschafterkonto. */
  gesellschafter?: string[];
  /** Abweichendes Geldkonto, falls nicht das Standard-Bankkonto bebucht wird. */
  geldkonto?: string;
};

/**
 * Schlaegt zu einem Bankumsatz den vollstaendigen Buchungssatz vor.
 *
 * Die Richtung ergibt sich aus dem Vorzeichen: Ein Eingang bucht Bank im Soll,
 * ein Ausgang Bank im Haben. Damit stimmt auch die Gegenbuchung einer
 * Rueckbuchung automatisch — sie traegt dieselbe Regel, nur andersherum.
 */
export function kontiereUmsatz(
  u: Pick<BankUmsatz, "betrag_cent" | "partner" | "verwendungszweck">,
  opt: KontierungsOptionen,
): Kontierung {
  const konten = KONTO[opt.rahmen];
  const geld = opt.geldkonto || STANDARDKONTEN[opt.rahmen].bank;
  const text = `${u.partner ?? ""} ${u.verwendungszweck ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();
  const richtung = u.betrag_cent >= 0 ? "eingang" : "ausgang";

  let gegenkonto = konten.klaerung;
  let steuer: Steuerschluessel = "0";
  let konfidenz: Konfidenz = "zu_pruefen";
  let regel = "klaerung";

  const treffer = REGELN.find(
    (r) => (!r.richtung || r.richtung === richtung) && r.muster.test(text),
  );

  if (treffer) {
    gegenkonto = konten[treffer.konto];
    steuer = treffer.steuer;
    konfidenz = treffer.konfidenz;
    regel = treffer.id;
  } else if (istGesellschafter(text, opt.gesellschafter ?? [])) {
    // Geld zwischen Firma und Gesellschafter, ohne erkennbaren Geschaeftsvorfall.
    gegenkonto = konten.gesellschafter;
    steuer = "0";
    konfidenz = "zu_pruefen";
    regel = "gesellschafter";
  }

  return {
    soll_konto: richtung === "eingang" ? geld : gegenkonto,
    haben_konto: richtung === "eingang" ? gegenkonto : geld,
    gegenkonto,
    steuerschluessel: steuer,
    buchungstext: buchungstext(u),
    konfidenz,
    regel,
  };
}
