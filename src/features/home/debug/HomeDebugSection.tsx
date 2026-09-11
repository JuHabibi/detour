"use client";

import { EventsDebugPanel } from "@/features/home/debug/EventsDebugPanel";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";

type HomeDebugSectionProps = {
  events: EventItem[];
  meta: EventsDebugMeta;
  onManualAiResult: (result: {
    highlights: EventItem[];
    planningEvents: EventItem[];
    debugMeta: EventsDebugMeta;
  }) => void;
};

/** Isolé pour code-splitting — non chargé si la home prod n’envoie pas debugMeta. */
export function HomeDebugSection({
  events,
  meta,
  onManualAiResult,
}: HomeDebugSectionProps) {
  return (
    <EventsDebugPanel
      events={events}
      meta={meta}
      onManualAiResult={onManualAiResult}
    />
  );
}
