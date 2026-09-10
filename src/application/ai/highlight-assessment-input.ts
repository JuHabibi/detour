import type { DetourEvent } from "@/domain/events/event";

/** Payload neutre envoyé à l’IA — sans scores déterministes. */
export type AiHighlightEventInput = {
  eventId: string;
  title: string;
  description: string | null;
  category: string | null;
  genre: string | null;
  venue: string | null;
  city: string | null;
  source: string | null;
  conditions: string | null;
  startAt: string;
  endAt: string | null;
  hasRegistrationUrl: boolean;
};

export function toAiHighlightEventInput(event: DetourEvent): AiHighlightEventInput {
  return {
    eventId: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    genre: event.genre,
    venue: event.venue,
    city: event.city,
    source: event.source,
    conditions: event.conditions,
    startAt: event.startAt,
    endAt: event.endAt,
    hasRegistrationUrl: Boolean(event.registrationUrl),
  };
}
