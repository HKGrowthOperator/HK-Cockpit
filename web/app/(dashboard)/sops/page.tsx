import { ModuleView } from "@/components/module-view";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await loadModule("sops");
  const def = MODULES.sops;
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Wiederholbare Abläufe & Playbooks — anlegen, bearbeiten, löschen.
      </p>
      <ModuleView module="sops" path="/sops" noun={def.noun} fields={def.fields} items={items} />
    </>
  );
}
