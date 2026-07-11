// lib/data/automation.ts — Automationen von der Idee bis live.
import type { Automation } from "./types";

export const automations: Automation[] = [
  { id: "aut-weekly-report", title: "Report-Erstellung wöchentlich", status: "im Bau", trigger: "Jeden Freitag 09:00, pro aktivem Kunden.", action: "Agent sammelt Kennzahlen, erstellt den Report aus der Vorlage, leitet ihn zur Freigabe an den Kundenbetreuer.", tools: ["Computer-Use-Agent", "Report-Vorlage", "Freigabe-Schritt"], value: "Spart ~3 Std./Woche pro Kundenbetreuer; verknüpft mit dem W23-Experiment." },
  { id: "aut-lead-intake", title: "Lead-Eingang & Weiterleitung", status: "Idee", trigger: "Neue Formular-Einsendung oder eingehende E-Mail.", action: "Lead parsen, gegen die Eignungs-Checkliste bewerten, CRM-Datensatz anlegen und Vertrieb bei heiß/warm benachrichtigen.", tools: ["Formular", "CRM", "Bewertungs-Prompt"], value: "Schnellere erste Reaktion; kein Lead geht verloren." },
  { id: "aut-onboarding-kit", title: "Onboarding-Kit-Generator", status: "Idee", trigger: "Vertrag als unterschrieben markiert.", action: "Kundenordner aus Vorlage anlegen, Willkommens-E-Mail senden und Kickoff planen.", tools: ["Laufwerk-Vorlage", "E-Mail", "Kalender"], value: "Verkürzt das Onboarding-Setup von Stunden auf Minuten; jedes Mal einheitlich." },
  { id: "aut-invoice-reminders", title: "Zahlungserinnerungen", status: "live", trigger: "Rechnung an Tag 7 und 14 unbezahlt.", action: "Freundliche Erinnerungs-Vorlage senden; Buchhaltung markieren, falls nach Tag 14 weiter offen.", tools: ["Buchhaltungstool", "E-Mail-Vorlage"], value: "Verbessert den Cashflow; entfällt manuelles Nachfassen." },
];
