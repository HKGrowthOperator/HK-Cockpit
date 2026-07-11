import { ModuleView } from "@/components/module-view";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await loadModule("websites");
  const def = MODULES.websites;
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">Kundenprojekte und ihr Build-Status.</p>
      <ModuleView module="websites" path="/webseiten" noun={def.noun} fields={def.fields} items={items} />
    </>
  );
}
