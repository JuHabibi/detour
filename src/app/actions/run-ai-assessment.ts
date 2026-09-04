"use server";

import { EventService } from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import { mapDetourEventToEventItem, mapDetourHighlightToEventItem } from "@/application/map-detour-event-to-ui";
import type { EventsDebugMeta } from "@/components/EventsDebugPanel";
import { getAiConfig } from "@/config/ai-config";
import type { EventItem } from "@/data/types";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import {
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} from "@/infrastructure/ai/next-ai-assessment-cache";
import { createDetourEventSource } from "@/infrastructure/create-detour-event-source";

const UPCOMING_WINDOW_DAYS = 180;

export type RunAiAssessmentResult =
  | {
      ok: true;
      highlights: EventItem[];
      planningEvents: EventItem[];
      debugMeta: EventsDebugMeta;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Déclenche l’évaluation IA sur la shortlist Détour uniquement.
 * Disponible seulement en mode manual + clé présente.
 * Ne constitue pas un proxy OpenAI générique.
 */
export async function runAiHighlightAssessment(options?: {
  force?: boolean;
}): Promise<RunAiAssessmentResult> {
  const config = getAiConfig();

  if (!config.enabled) {
    return { ok: false, error: "IA désactivée (clé API absente)." };
  }
  if (config.mode !== "manual") {
    return {
      ok: false,
      error: "Run AI assessment est réservé au mode manual.",
    };
  }

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const eventService = new EventService(
    createDetourEventSource(),
    createHighlightAssessmentProvider(),
    {
      aiConfig: config,
      readThrough: createNextAiAssessmentReadThrough(),
      onForceInvalidate: invalidateNextAiAssessmentCache,
    },
  );

  try {
    const result = await eventService.runManualAiAssessment({
      from,
      to,
      force: options?.force ?? false,
    });

    return {
      ok: true,
      highlights: result.highlights.map((highlight) =>
        mapDetourHighlightToEventItem(highlight),
      ),
      planningEvents: result.planningEvents.map((item) =>
        mapDetourEventToEventItem(item.event),
      ),
      debugMeta: buildEventsDebugMeta(result),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Évaluation IA impossible.";
    console.error("[detour] manual AI assessment failed", message);
    return { ok: false, error: message };
  }
}
