"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MonatsWert } from "@/lib/accounting/auswertung";

const MONATSKUERZEL = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const euro = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const TOOLTIP = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 13,
    boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
  },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
};

/** Jahresverlauf, umschaltbar zwischen Balken (Vergleich) und Fläche (Ergebnis). */
export function VerlaufChart({ data }: { data: MonatsWert[] }) {
  const [ansicht, setAnsicht] = useState<"vergleich" | "ergebnis">("vergleich");

  const serie = data.map((d, i) => ({
    monat: MONATSKUERZEL[i] ?? d.monat.slice(5),
    Einnahmen: d.einnahmen,
    Ausgaben: d.ausgaben,
    Ergebnis: d.ergebnis,
  }));

  return (
    <div className="grid gap-4">
      <div className="flex justify-end gap-1">
        {([
          ["vergleich", "Einnahmen / Ausgaben"],
          ["ergebnis", "Ergebnis"],
        ] as const).map(([wert, label]) => (
          <button
            key={wert}
            type="button"
            onClick={() => setAnsicht(wert)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              ansicht === wert
                ? "bg-primary text-primary-foreground"
                : "border text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {ansicht === "vergleich" ? (
          <BarChart data={serie} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="monat" tickLine={false} axisLine={false} fontSize={12}
              stroke="var(--muted-foreground)" />
            <YAxis tickFormatter={euro} tickLine={false} axisLine={false} fontSize={12}
              width={72} stroke="var(--muted-foreground)" />
            <Tooltip formatter={(v) => euro(Number(v))} cursor={{ fill: "var(--muted)", opacity: 0.4 }} {...TOOLTIP} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Einnahmen" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Ausgaben" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        ) : (
          <AreaChart data={serie} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gErgebnis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="monat" tickLine={false} axisLine={false} fontSize={12}
              stroke="var(--muted-foreground)" />
            <YAxis tickFormatter={euro} tickLine={false} axisLine={false} fontSize={12}
              width={72} stroke="var(--muted-foreground)" />
            <Tooltip formatter={(v) => euro(Number(v))} {...TOOLTIP} />
            <Area type="monotone" dataKey="Ergebnis" stroke="var(--chart-1)" strokeWidth={2}
              fill="url(#gErgebnis)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
