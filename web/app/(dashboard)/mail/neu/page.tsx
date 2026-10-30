import Link from "next/link";
import { MailFormular } from "@/components/zentrale/mail-formular";
import { ladeKonten } from "@/lib/zentrale/mail/konten";
import { q } from "@/lib/db";
import { zentraleBereit } from "@/lib/zentrale/schema";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; an?: string; betreff?: string; text?: string; schluessel?: string; herkunft?: string }> }) {
  const p = await searchParams;
  await zentraleBereit();
  const [konten, vorlagen] = await Promise.all([
    ladeKonten(),
    q<{ id: string; name: string; betreff: string; text: string }>("SELECT id, name, betreff, text FROM mail_vorlagen ORDER BY name"),
  ]);
  let start: Parameters<typeof MailFormular>[0]["start"] = {
    an: p.an, betreff: p.betreff, text: p.text,
    schluessel: p.schluessel && /^[\w:.-]{4,120}$/.test(p.schluessel) ? p.schluessel : undefined,
    herkunft: p.herkunft === "rechnung" ? "rechnung" : undefined,
  };
  if (p.id && /^[0-9a-f-]{36}$/i.test(p.id)) {
    const rows = await q<{ id: string; an: string; betreff: string; text: string; konto_id: string | null; status: string }>(
      "SELECT id, an, betreff, text, konto_id, status FROM mail_ausgang WHERE id = $1", [p.id],
    );
    const m = rows[0];
    if (m && ["entwurf", "wartet", "fehler"].includes(m.status)) start = { id: m.id, an: m.an, betreff: m.betreff, text: m.text, konto_id: m.konto_id ?? "" };
  }
  if (!konten.length) {
    return (
      <p className="text-sm">
        Zum Schreiben braucht es ein Postfach. <Link href="/mail/konten" className="underline">Postfach einrichten</Link>
        {" "}(oder SMTP_HOST, SMTP_USER, SMTP_PASS in der Umgebung setzen).
      </p>
    );
  }
  return (
    <MailFormular
      konten={konten.map((k) => ({ id: k.id ?? "", text: `${k.absender_name} <${k.absender_adresse}>${k.standard ? " (Standard)" : ""}` }))}
      vorlagen={vorlagen}
      start={start}
    />
  );
}
