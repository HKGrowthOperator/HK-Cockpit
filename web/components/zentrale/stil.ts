// Gemeinsame Klassen für Knöpfe und Felder — ohne "use client", damit auch
// Server-Komponenten sie nutzen können.
import { cn } from "@/lib/utils";

export function knopfKlasse(variante: "primaer" | "zweit" | "leise" | "gefahr" = "primaer"): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
    variante === "primaer" && "bg-primary text-primary-foreground hover:bg-[#3a4734]",
    variante === "zweit" && "border-border bg-card hover:border-gold border",
    variante === "leise" && "text-muted-foreground hover:text-foreground hover:bg-accent",
    variante === "gefahr" && "text-rust hover:bg-rust/10",
  );
}

export const feldKlasse =
  "border-input bg-card w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-gold";
