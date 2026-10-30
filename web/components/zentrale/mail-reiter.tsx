"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const REITER = [
  { href: "/mail", label: "Ausgang" },
  { href: "/mail/neu", label: "Neue Mail" },
  { href: "/mail/vorlagen", label: "Vorlagen" },
  { href: "/mail/regeln", label: "Automationen" },
  { href: "/mail/konten", label: "Postfächer" },
];

export function MailReiter() {
  const pfad = usePathname();
  return (
    <nav aria-label="Mail-Zentrale" className="border-border mb-6 flex gap-1 overflow-x-auto border-b">
      {REITER.map((r) => {
        const aktiv = r.href === "/mail" ? pfad === "/mail" : pfad.startsWith(r.href);
        return (
          <Link key={r.href} href={r.href} aria-current={aktiv ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              aktiv ? "border-gold text-foreground font-semibold" : "text-muted-foreground hover:text-foreground border-transparent")}>
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}
