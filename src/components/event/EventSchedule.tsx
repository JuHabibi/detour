import type { EventItem } from "@/data/types";

/** Le détail et la modale montrent les dates réelles, jamais leur enveloppe. */
export function EventSchedule({
  event,
}: {
  event: Pick<EventItem, "occurrences" | "startAt">;
}) {
  const occurrences = event.occurrences;
  if (!occurrences || occurrences.length < 2) return null;
  const visible = occurrences.filter(
    (o) =>
      !event.startAt ||
      Date.parse(o.endAt) > Date.parse(event.startAt) ||
      o.startAt === event.startAt,
  );
  if (visible.length < 2) return null;
  return (
    <details className="mt-4 border-t border-line/70 pt-3 text-sm text-cream-dim">
      <summary className="cursor-pointer text-ink">
        Voir les {visible.length} séances
      </summary>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {visible.map((o) => (
          <li key={`${o.startAt}/${o.endAt}`}>
            <time dateTime={o.startAt}>{format(o.startAt, o.allDay)}</time>
            {o.endAt !== o.startAt ? (
              <>
                {" "}
                –{" "}
                <time dateTime={o.endAt}>
                  {format(
                    o.allDay
                      ? new Date(Date.parse(o.endAt) - 1).toISOString()
                      : o.endAt,
                    o.allDay,
                  )}
                </time>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function format(iso: string, allDay: boolean): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(!allDay ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(iso));
}
