// lib/data/automation.ts — Automationen von der Idee bis live.
// Einzige Datenquelle: automations.json (wird auch vom Seed-Script scripts/seed-automations.mjs genutzt),
// damit App-Seeding und DB-Seeding niemals auseinanderlaufen.
import type { Automation } from "./types";
import data from "./automations.json";

export const automations: Automation[] = data as Automation[];
