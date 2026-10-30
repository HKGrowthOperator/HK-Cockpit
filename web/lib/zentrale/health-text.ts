// Anzeigetexte der Erreichbarkeit — ohne Netzcode, damit auch Client-Komponenten sie nutzen.
import type { Zustand } from "./health";

export const ZUSTAND_TEXT: Record<Zustand, string> = {
  ok: "läuft",
  langsam: "langsam",
  gestoert: "gestört",
  "nicht-erreichbar": "nicht erreichbar",
  unbekannt: "nicht geprüft",
};
