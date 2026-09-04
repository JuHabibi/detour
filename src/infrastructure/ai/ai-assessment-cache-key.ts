import { createHash } from "node:crypto";
import type { DetourEvent } from "@/domain/event";

export type AiAssessmentCacheFingerprint = {
  id: string;
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

export function toAiAssessmentCacheFingerprint(
  event: DetourEvent,
): AiAssessmentCacheFingerprint {
  return {
    id: event.id,
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

/** Clé déterministe SHA-256 sur le contenu ordonné de la shortlist. */
export function buildAiAssessmentCacheKey(events: DetourEvent[]): string {
  const fingerprint = events.map(toAiAssessmentCacheFingerprint);
  return createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex");
}

export function shortenCacheKey(cacheKey: string, length = 12): string {
  return cacheKey.slice(0, length);
}
