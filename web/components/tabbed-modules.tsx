"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ModuleView, type ViewItem } from "@/components/module-view";
import type { Field } from "@/lib/modules";

export type ModuleSection = {
  label: string;
  module: string;
  path: string;
  noun: string;
  fields: Field[];
  items: ViewItem[];
  min?: string;
};

export function TabbedModules({ sections }: { sections: ModuleSection[] }) {
  const [active, setActive] = useState(0);
  const s = sections[active] ?? sections[0];
  return (
    <div>
      <div className="border-border mb-4 flex flex-wrap gap-2 border-b pb-2">
        {sections.map((sec, i) => (
          <button
            key={sec.module}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold",
              i === active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            {sec.label} <span className="opacity-60">({sec.items.length})</span>
          </button>
        ))}
      </div>
      <ModuleView
        key={s.module}
        module={s.module}
        path={s.path}
        noun={s.noun}
        fields={s.fields}
        items={s.items}
        min={s.min}
      />
    </div>
  );
}
