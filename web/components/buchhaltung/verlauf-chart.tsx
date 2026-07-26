"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MonatsWert } from "@/lib/accounting/auswertung";

const MONATSKUERZEL = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function VerlaufChart({ data }: { data: MonatsWert[] }) {
  const serie = data.map((d, i) => ({
    monat: MONATSKUERZEL[i] ?? d.monat.slice(5),
    Einnahmen: d.einnahmen,
    Ausgaben: d.ausgaben,
  }));

  const euro = (v: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={serie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="monat" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickFormatter={euro} tickLine={false} axisLine={false} fontSize={12} width={80} />
        <Tooltip
          formatter={(v) => euro(Number(v))}
          contentStyle={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 8, fontSize: 13,
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="Einnahmen" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Ausgaben" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
