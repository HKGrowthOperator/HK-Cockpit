// Relative Zeitangaben auf Deutsch („vor 3 Std."), serverseitig berechnet.
export function seit(iso: string | null | undefined, jetzt = Date.now()): string {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "–";
  const s = Math.round((jetzt - t) / 1000);
  if (s < 0) {
    const m = Math.round(-s / 60);
    if (m < 60) return `in ${m} Min.`;
    const h = Math.round(m / 60);
    return h < 48 ? `in ${h} Std.` : `in ${Math.round(h / 24)} Tagen`;
  }
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "gestern" : `vor ${d} Tagen`;
  return new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function datumZeit(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}
