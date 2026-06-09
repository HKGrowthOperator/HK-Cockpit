import { TabbedModules } from "@/components/tabbed-modules";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";
const PATH = "/ai-intelligence";

const TABS: { label: string; key: string }[] = [
  { label: "Updates", key: "ai_updates" },
  { label: "Experimente", key: "ai_experiments" },
  { label: "Chancen", key: "ai_opportunities" },
  { label: "Lernen", key: "ai_learning" },
  { label: "Risiken", key: "ai_risks" },
];

export default async function Page() {
  const loaded = await Promise.all(TABS.map((t) => loadModule(t.key)));
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        KI-Updates als Business-Intelligence — Relevanz, Risiko und Hype. Selbst pflegbar.
      </p>
      <TabbedModules
        sections={TABS.map((t, i) => ({
          label: t.label,
          module: t.key,
          path: PATH,
          noun: MODULES[t.key].noun,
          fields: MODULES[t.key].fields,
          items: loaded[i],
        }))}
      />
    </>
  );
}
