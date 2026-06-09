import { ModuleView } from "@/components/module-view";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await loadModule("automations");
  const def = MODULES.automations;
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Automatisierungen von der Idee bis live — Auslöser → Aktion → Nutzen.
      </p>
      <ModuleView module="automations" path="/automation" noun={def.noun} fields={def.fields} items={items} />
    </>
  );
}
