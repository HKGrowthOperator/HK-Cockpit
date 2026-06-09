// lib/leads.ts — KI-Lead-Radar. Findet echte Betriebe über OpenStreetMap
// (Nominatim für den Ort, Overpass für die Treffer). Kostenlos, kein API-Key.
// Für eine Wachstumsagentur ist das stärkste Signal: kein Website-Eintrag =
// heißer Lead (verschenkt Online-Anfragen).

export type LeadCategory = { id: string; label: string; emoji: string; filters: string[] };

// filters sind Overpass-Tag-Ausdrücke (node + way werden je Filter abgefragt).
export const LEAD_CATEGORIES: LeadCategory[] = [
  { id: "dentist", label: "Zahnärzte", emoji: "🦷", filters: ['"amenity"="dentist"'] },
  { id: "doctor", label: "Arztpraxen", emoji: "🩺", filters: ['"amenity"="doctors"', '"healthcare"="doctor"'] },
  { id: "physio", label: "Physiotherapie", emoji: "💪", filters: ['"healthcare"="physiotherapist"', '"shop"="massage"'] },
  { id: "hairdresser", label: "Friseure", emoji: "💇", filters: ['"shop"="hairdresser"'] },
  { id: "beauty", label: "Kosmetik & Beauty", emoji: "💅", filters: ['"shop"="beauty"', '"shop"="cosmetics"'] },
  { id: "restaurant", label: "Restaurants", emoji: "🍽️", filters: ['"amenity"="restaurant"'] },
  { id: "cafe", label: "Cafés", emoji: "☕", filters: ['"amenity"="cafe"'] },
  { id: "fitness", label: "Fitnessstudios", emoji: "🏋️", filters: ['"leisure"="fitness_centre"'] },
  { id: "car_repair", label: "KFZ-Werkstätten", emoji: "🔧", filters: ['"shop"="car_repair"'] },
  { id: "craft", label: "Handwerksbetriebe", emoji: "🛠️", filters: ['"craft"', '"shop"="doityourself"'] },
  { id: "estate", label: "Immobilienmakler", emoji: "🏠", filters: ['"office"="estate_agent"'] },
  { id: "lawyer", label: "Anwälte", emoji: "⚖️", filters: ['"office"="lawyer"'] },
  { id: "tax", label: "Steuerberater", emoji: "📑", filters: ['"office"="tax_advisor"', '"office"="accountant"'] },
];

export function getCategory(id: string): LeadCategory | undefined {
  return LEAD_CATEGORIES.find((c) => c.id === id);
}

// Euer Leistungs-Spektrum (AI-First-Positionierung). Jede Leistung wird über ein
// im Kartendatensatz erkennbares Signal einem Lead zugeordnet — ehrlich, also nur
// was sich aus öffentlichen Daten ableiten lässt. Automatisierung & KI ist der
// rote Faden und passt grundsätzlich für jeden Betrieb.
export type Service = { id: string; label: string };
export const LEAD_SERVICES: Service[] = [
  { id: "check", label: "HK Wachstums-Check" },
  { id: "website", label: "Website" },
  { id: "social", label: "Social Media" },
];

export type Lead = {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  gaps: string[]; // erkannte Lücken (Belege)
  services: Service[]; // passende Leistungen aus eurem Spektrum
  score: number; // Anzahl Lücken → Größe der Chance (0–3)
  priority: "A" | "B" | "C"; // A = größte Chance
  hot: boolean; // klare Chance (≥2 Lücken oder keine Website)
  reason: string;
};

const UA = "HK-Growth-Cockpit/1.0 (Lead-Radar; +https://localhost)";

async function fetchJson(url: string, init?: RequestInit, ms = 20000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

type OverpassEl = { tags?: Record<string, string> };

export type LeadSearchResult = { area: string; leads: Lead[]; total: number; hotCount: number };

/** Sucht echte Betriebe einer Branche an einem Ort und bewertet sie als Leads.
 *  Overpass sucht direkt im benannten Verwaltungsgebiet (kein separater Geocoder). */
export async function searchLeads(categoryId: string, place: string, limit = 40): Promise<LeadSearchResult> {
  const cat = getCategory(categoryId);
  if (!cat) throw new Error("Unbekannte Branche.");
  if (!place.trim()) throw new Error("Bitte einen Ort angeben.");

  const name = JSON.stringify(place.trim()); // sicher escaped, in Anführungszeichen
  const body = cat.filters
    .map((f) => `node[${f}](area.a);way[${f}](area.a);`)
    .join("");
  const ql = `[out:json][timeout:25];area["name"=${name}]["boundary"="administrative"]->.a;(${body});out center tags ${Math.min(limit * 3, 200)};`;

  // Mehrere Overpass-Spiegel — der erste erreichbare gewinnt.
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  let data: { elements?: OverpassEl[] } | null = null;
  let lastErr: Error | null = null;
  for (const ep of endpoints) {
    try {
      data = (await fetchJson(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(ql),
      }, 30000)) as { elements?: OverpassEl[] };
      break;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  if (!data) throw lastErr ?? new Error("Kein Overpass-Server erreichbar.");

  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (const el of data.elements ?? []) {
    const t = el.tags;
    if (!t?.name) continue;
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
    const city = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
    const address = [street, city].filter(Boolean).join(", ");
    const key = `${t.name.toLowerCase()}|${street.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const phone = t.phone || t["contact:phone"] || t["contact:mobile"];
    const email = t.email || t["contact:email"];
    const website = t.website || t["contact:website"] || t.url;
    const instagram = t["contact:instagram"] || t.instagram;
    const facebook = t["contact:facebook"] || t.facebook;

    // Erkennbare Lücken aus den öffentlichen Kartendaten
    const noWebsite = !website;
    const noSocial = !instagram && !facebook;
    const noEmail = !email;
    const gaps: string[] = [];
    if (noWebsite) gaps.push("keine Website");
    if (noSocial) gaps.push("keine Social-Media-Profile");
    if (noEmail) gaps.push("keine E-Mail hinterlegt");

    // Lücken → passende HK-Angebote
    const services: Service[] = [];
    if (noWebsite) services.push({ id: "website", label: "Website" });
    if (noSocial) services.push({ id: "social", label: "Social Media" });
    // Der HK Wachstums-Check ist immer der Einstieg (Diagnose statt Pitch).
    services.push({ id: "check", label: "HK Wachstums-Check" });

    const score = gaps.length;
    const hot = score >= 2 || noWebsite;
    const priority: "A" | "B" | "C" = score >= 2 ? "A" : score === 1 ? "B" : "C";
    const reason =
      score === 0
        ? "Digital ordentlich aufgestellt — Einstieg über den HK Wachstums-Check (Feintuning Anfrageweg & Conversion)."
        : `${gaps.join(", ")} — Ansatzpunkt für ${services.map((s) => s.label).join(" · ")}.`;

    leads.push({ name: t.name, address, phone, email, website, instagram, facebook, gaps, services, score, priority, hot, reason });
  }

  // Größte Chancen zuerst (meiste Lücken), darunter die mit Telefon priorisiert.
  leads.sort((a, b) => b.score - a.score || Number(!!b.phone) - Number(!!a.phone));
  const sliced = leads.slice(0, limit);
  return { area: place.trim(), leads: sliced, total: leads.length, hotCount: leads.filter((l) => l.hot).length };
}
