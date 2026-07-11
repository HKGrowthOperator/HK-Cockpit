"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModuleCard } from "@/components/cards";
import { EntityForm } from "@/components/entity-form";
import { saveItem, removeItem } from "@/app/actions";
import type { CardModel } from "@/lib/data/types";
import type { Field } from "@/lib/modules";

export type ViewItem = { id: string; card: CardModel; values: Record<string, unknown> };
type Editing = { mode: "add" } | { mode: "edit"; item: ViewItem } | null;

export function ModuleView({
  module,
  path,
  noun,
  fields,
  items,
  min = "340px",
}: {
  module: string;
  path: string;
  noun: string;
  fields: Field[];
  items: ViewItem[];
  min?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((it) =>
      (it.card.title + " " + JSON.stringify(it.values)).toLowerCase().includes(t),
    );
  }, [items, q]);

  async function handleSave(data: Record<string, unknown>) {
    await saveItem({
      module,
      path,
      id: editing?.mode === "edit" ? editing.item.id : undefined,
      data,
    });
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(item: ViewItem) {
    if (!window.confirm("Diesen Eintrag wirklich löschen?")) return;
    setBusyId(item.id);
    await removeItem({ id: item.id, path });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suchen…"
          aria-label="Suchen"
          className="bg-card border-border focus:ring-ring w-full max-w-xs rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
        <span className="text-muted-foreground text-xs">{filtered.length} Einträge</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setEditing({ mode: "add" })}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734]"
        >
          + Neu: {noun}
        </button>
      </div>

      {filtered.length ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}
        >
          {filtered.map((it) => (
            <ModuleCard
              key={it.id}
              model={it.card}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", item: it })}
                    className="border-border hover:bg-secondary rounded-md border px-3 py-1.5 text-xs font-semibold"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    disabled={busyId === it.id}
                    onClick={() => handleDelete(it)}
                    className="border-rust/40 text-rust hover:bg-rust/10 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {busyId === it.id ? "Löschen…" : "Löschen"}
                  </button>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Noch keine Einträge. Lege mit „+ Neu: {noun}“ den ersten an.
        </p>
      )}

      {editing && (
        <EntityForm
          title={editing.mode === "edit" ? `${noun} bearbeiten` : `${noun} anlegen`}
          fields={fields}
          initial={editing.mode === "edit" ? editing.item.values : undefined}
          onCancel={() => setEditing(null)}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}
