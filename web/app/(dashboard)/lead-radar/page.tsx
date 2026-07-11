import { LeadRadar } from "@/components/lead-radar";
import { LEAD_CATEGORIES, LEAD_SERVICES } from "@/lib/leads";

export const dynamic = "force-dynamic";

export default function Page() {
  const categories = LEAD_CATEGORIES.map(({ id, label, emoji }) => ({ id, label, emoji }));
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Finde echte Betriebe in deiner Zielbranche & Region (Standard: Gummersbach). Jeder Lead wird gegen HKs Angebote geprüft (Wachstums-Check, Website, Social Media) — du siehst pro Betrieb die Lücken und passenden Hebel. „🔍 Analysieren" erstellt ein Dossier, „Cold-Mail" lädt im HK-Ton zum Wachstums-Check ein.
      </p>
      <LeadRadar categories={categories} services={LEAD_SERVICES} />
    </>
  );
}
