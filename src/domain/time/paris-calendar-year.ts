const PARIS_TZ = "Europe/Paris";

/** Année civile Europe/Paris (YYYY). */
export function parisCalendarYear(date: Date): string {
  return (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PARIS_TZ,
      year: "numeric",
    })
      .formatToParts(date)
      .find((part) => part.type === "year")?.value ?? ""
  );
}

/** True si l’année civile Paris de `date` ≠ celle de `now` (défaut : maintenant). */
export function isOtherParisCalendarYear(
  date: Date,
  now: Date = new Date(),
): boolean {
  const eventYear = parisCalendarYear(date);
  const todayYear = parisCalendarYear(now);
  return Boolean(eventYear && todayYear && eventYear !== todayYear);
}
