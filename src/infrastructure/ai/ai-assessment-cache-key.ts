import { createHash } from "node:crypto";
import { toAiHighlightEventInput } from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";

/**
 * @deprecated Fingerprint dédié — préférer `toAiHighlightEventInput` via
 * `buildAiAssessmentEventCacheKey` (commit suivant : cache per-event).
 */
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

/** @deprecated Voir `buildAiAssessmentEventCacheKey`. */
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

/**
 * @deprecated Clé shortlist entière — remplacée par des clés per-event.
 * Conservée tant que `assessHighlightsCached` l’utilise encore.
 */
export function buildAiAssessmentCacheKey(events: DetourEvent[]): string {
  const fingerprint = events.map(toAiAssessmentCacheFingerprint);
  return createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex");
}

/** Config de génération incluse dans la clé per-event. */
export type AiAssessmentGenerationConfig = {
  temperature: number;
};

export type AiAssessmentEventCacheKeyParams = {
  event: DetourEvent;
  model: string;
  promptVersion: string;
  generation: AiAssessmentGenerationConfig;
};

/**
 * Clé d’assessment par événement.
 * Payload = exactement l’input IA + model + promptVersion + génération.
 * Pas de second fingerprint event divergent.
 */
export function buildAiAssessmentEventCacheKey(
  params: AiAssessmentEventCacheKeyParams,
): string {
  const payload = {
    input: toAiHighlightEventInput(params.event),
    model: params.model,
    promptVersion: params.promptVersion,
    generation: params.generation,
  };
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function shortenCacheKey(cacheKey: string, length = 12): string {
  return cacheKey.slice(0, length);
}
