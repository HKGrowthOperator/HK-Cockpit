import { ModuleView } from "@/components/module-view";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";
import { n8nKonfiguriert } from "@/lib/automations-run";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await loadModule("automations");
  const def = MODULES.automations;
  const startbar = n8nKonfiguriert();
  return (
    <>
      <p className="text-muted-foreground mb-2 text-sm">
        Automatisierungen von der Idee bis live — Auslöser → Aktion → Nutzen.
      </p>
      {!startbar && (
        <p className="mb-6 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold-ink">
          n8n ist noch nicht verbunden — deshalb fehlt der Startknopf. Dafür{" "}
          <code className="font-mono text-xs">N8N_BASE_URL</code> in den Umgebungsvariablen
          des Cockpits eintragen (Adresse der n8n-Ressource) und neu deployen.
        </p>
      )}
      {startbar && <div className="mb-6" />}
      <ModuleView module="automations" path="/automation" noun={def.noun} fields={def.fields} items={items} startbar={startbar} />
    </>
  );
}
