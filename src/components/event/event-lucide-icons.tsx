"use client";

import { CalendarClock, MapPin, MoveUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Trait Lucide — lisible à 16 px, sans fond. */
export const EVENT_META_ICON_STROKE = 1.75;

export function EventMapPinIcon({ className }: { className?: string }) {
  return (
    <MapPin
      aria-hidden
      className={cn("size-4 shrink-0 text-coral", className)}
      strokeWidth={EVENT_META_ICON_STROKE}
    />
  );
}

export function EventCalendarClockIcon({ className }: { className?: string }) {
  return (
    <CalendarClock
      aria-hidden
      className={cn("size-4 shrink-0 text-coral", className)}
      strokeWidth={EVENT_META_ICON_STROKE}
    />
  );
}

/** Flèche plate — coral sur Radar, sombre (currentColor) sur le CTA modale. */
export function EventMoveUpRightIcon({ className }: { className?: string }) {
  return (
    <MoveUpRight
      aria-hidden
      className={cn("size-4 shrink-0 text-coral", className)}
      strokeWidth={EVENT_META_ICON_STROKE}
    />
  );
}
