import { TabbedModules } from "@/components/tabbed-modules";
import { loadModule } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";
const PATH = "/kundenbedienung";

export default async function Page() {
  const [clients, templates] = await Promise.all([loadModule("clients"), loadModule("templates")]);
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Kunden verwalten und Antwortvorlagen pflegen ({"{{Platzhalter}}"} vor dem Senden ersetzen).
      </p>
      <TabbedModules
        sections={[
          { label: "Kunden", module: "clients", path: PATH, noun: MODULES.clients.noun, fields: MODULES.clients.fields, items: clients, min: "360px" },
          { label: "Vorlagen", module: "templates", path: PATH, noun: MODULES.templates.noun, fields: MODULES.templates.fields, items: templates, min: "360px" },
        ]}
      />
    </>
  );
}
