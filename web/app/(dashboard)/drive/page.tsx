import { DriveBrowser } from "@/components/drive-browser";
import { googleConfigured, getStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  state: "Verbindung abgebrochen (Sicherheitsprüfung). Bitte erneut versuchen.",
  exchange: "Verbindung fehlgeschlagen. Bitte erneut „Mit Google verbinden“ klicken.",
  "not-configured": "Google-Anbindung ist noch nicht eingerichtet (Schlüssel fehlen).",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const configured = await googleConfigured();
  const status = configured ? await getStatus() : { connected: false as boolean, email: undefined };

  const err = typeof sp.error === "string" ? sp.error : undefined;
  const notice = sp.connected === "1" ? "✓ Google Drive verbunden." : err ? (NOTICE[err] ?? "Es ist ein Fehler aufgetreten.") : undefined;

  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Verbinde Google Drive, durchsuche deine Dateien und mach mit einem Klick OS-Einträge daraus (SOPs, Kunden, Konzepte …).
      </p>
      <DriveBrowser configured={configured} connected={status.connected} email={status.email} notice={notice} />
    </>
  );
}
