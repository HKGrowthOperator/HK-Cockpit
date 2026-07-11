import { ModuleView } from "@/components/module-view";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await loadModule("concepts");
  const def = MODULES.concepts;
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Angebote, Strategien und Kampagnen in Entwicklung.
      </p>
      <ModuleView module="concepts" path="/konzepte" noun={def.noun} fields={def.fields} items={items} />
    </>
  );
}
