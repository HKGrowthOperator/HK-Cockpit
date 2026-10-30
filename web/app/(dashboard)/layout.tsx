import { AppShell } from "@/components/app-shell";
import { aktuellerNutzer } from "@/lib/zentrale/nutzer";
import { ladeApps } from "@/lib/zentrale/apps";
import { ausgangZahlen } from "@/lib/zentrale/mail/ausgang";
import { navigation, palettenEintraege } from "@/lib/zentrale/navigation";

// Shell für das ganze Cockpit: Seitenleiste, Kopfzeile, Befehlspalette.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [nutzer, apps, mails] = await Promise.all([
    aktuellerNutzer().catch(() => null),
    ladeApps().catch(() => []),
    ausgangZahlen().catch(() => null),
  ]);
  const offen = (mails?.wartet ?? 0) + (mails?.entwurf ?? 0) + (mails?.fehler ?? 0);
  const nav = navigation(apps, offen);
  return (
    <AppShell name={nutzer?.name} rolle={nutzer?.rolle} nav={nav} palette={palettenEintraege(apps, nav)}>
      {children}
    </AppShell>
  );
}
