/**
 * Jour civil affiché par react-day-picker.
 *
 * DayPicker construit des `Date` à minuit *local*. La clé YYYY-MM-DD envoyée
 * au backend est la date civile du calendrier (getFullYear/Month/Date), pas
 * un instant converti via Europe/Paris — sinon un fuseau ≠ Paris décale le jour.
 *
 * Le backend interprète ensuite cette clé comme jour civil Europe/Paris.
 */

/** `YYYY-MM-DD` → Date locale à minuit (cellule DayPicker). */
export function parisDateKeyToCalendarDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Date cellule DayPicker → clé `YYYY-MM-DD` (composantes locales). */
export function calendarDayToParisDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
