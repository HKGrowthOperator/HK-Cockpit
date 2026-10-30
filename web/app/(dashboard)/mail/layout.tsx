import { MailReiter } from "@/components/zentrale/mail-reiter";

// Mail-Zentrale: Mails nach außen, die ein Mensch freigibt — oder die eine
// Regel der Geschäftsführung automatisch senden darf. Cold Mailing läuft nicht
// hier, sondern ausschließlich in Coldmail.
export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MailReiter />
      {children}
    </>
  );
}
