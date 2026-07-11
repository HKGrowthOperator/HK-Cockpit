import { ApiKeySettings } from "@/components/api-key-settings";
import { GoogleSettings } from "@/components/google-settings";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">Zentrale Einstellungen für dein Cockpit.</p>
      <div className="space-y-5">
        <ApiKeySettings />
        <GoogleSettings />
      </div>
    </>
  );
}
