/**
 * Écart en jours civils Europe/Paris entre deux instants ISO.
 * Positif si `to` est après `from` (ex. jours restant avant le début).
 */
export function parisCalendarDaysBetween(
  fromIso: string,
  toIso: string,
): number | null {
  const fromKey = parisDateKey(fromIso);
  const toKey = parisDateKey(toIso);
  if (!fromKey || !toKey) return null;

  const fromMs = Date.parse(`${fromKey}T12:00:00.000Z`);
  const toMs = Date.parse(`${toKey}T12:00:00.000Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;

  return Math.round((toMs - fromMs) / 86_400_000);
}

function parisDateKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}
