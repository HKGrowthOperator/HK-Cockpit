"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Field } from "@/lib/modules";

const inputCls =
  "bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none";

function toFieldString(field: Field, value: unknown): string {
  if (value == null) return "";
  if (field.type === "list") return Array.isArray(value) ? value.join("\n") : String(value);
  if (field.type === "tags") return Array.isArray(value) ? value.join(", ") : String(value);
  return String(value);
}

function parseField(field: Field, raw: string): unknown {
  const t = raw.trim();
  if (field.type === "list") return raw.split("\n").map((s) => s.trim()).filter(Boolean);
  if (field.type === "tags") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (field.type === "number") return t === "" ? null : Number(t);
  return t;
}

export function EntityForm({
  title,
  fields,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  fields: Field[];
  initial?: Record<string, unknown>;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.name] = toFieldString(f, initial?.[f.name]);
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, val: string) => setValues((p) => ({ ...p, [name]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { ...(initial ?? {}) };
    for (const f of fields) {
      if (f.required && !values[f.name].trim()) {
        setError(`Bitte „${f.label}“ ausfüllen.`);
        return;
      }
      data[f.name] = parseField(f, values[f.name] ?? "");
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(data);
    } catch {
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="bg-card text-card-foreground border-border max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={cn("flex flex-col gap-1", f.full && "sm:col-span-2")}>
              <label className="text-muted-foreground text-xs font-medium">
                {f.label}
                {f.required && <span className="text-rust"> *</span>}
              </label>
              {f.type === "textarea" || f.type === "list" ? (
                <textarea
                  className={cn(inputCls, "min-h-[90px] resize-y")}
                  value={values[f.name]}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select className={inputCls} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">— bitte wählen —</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  className={inputCls}
                  value={values[f.name]}
                  placeholder={f.placeholder ?? (f.type === "tags" ? "mit Komma trennen" : undefined)}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && <p className="text-rust text-sm sm:col-span-2">{error}</p>}

          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={onCancel}
              className="border-border text-muted-foreground hover:text-foreground rounded-md border px-4 py-2 text-sm"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-[#3a4734] disabled:opacity-60"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
