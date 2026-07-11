import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "good" | "warn" | "bad";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  good: "text-primary",
  warn: "text-amber-700",
  bad: "text-rust",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-4xl font-bold tabular-nums", toneClass[tone])}>
          {value}
        </div>
        {hint ? (
          <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
