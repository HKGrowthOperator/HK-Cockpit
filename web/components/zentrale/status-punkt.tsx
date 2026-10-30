import { cn } from "@/lib/utils";
import type { Zustand } from "@/lib/zentrale/health";
import { ZUSTAND_TEXT } from "@/lib/zentrale/health-text";

const farbe: Record<Zustand, string> = {
  ok: "bg-moss",
  langsam: "bg-gold",
  gestoert: "bg-rust puls",
  "nicht-erreichbar": "bg-rust puls",
  unbekannt: "bg-stone",
};

export function StatusPunkt({ zustand, groesse = "sm", titel }: { zustand: Zustand; groesse?: "sm" | "md"; titel?: string }) {
  return (
    <span
      role="img"
      aria-label={ZUSTAND_TEXT[zustand]}
      title={titel ?? ZUSTAND_TEXT[zustand]}
      className={cn("inline-block shrink-0 rounded-full", groesse === "md" ? "h-3 w-3" : "h-2 w-2", farbe[zustand])}
    />
  );
}
