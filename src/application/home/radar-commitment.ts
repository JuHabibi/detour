import { createHash } from "node:crypto";
import type { AiAssessmentCacheSource } from "@/application/ai/ai-assessment-cache";
import type {
  AiHighlightSelectionMeta,
  EventHighlight,
  HighlightReason,
  HighlightSelectionSource,
  HighlightSlot,
} from "@/domain/editorial/select-detour-highlights";
import type { DetourEvent } from "@/domain/events/event";
import { selectEventInWindow } from "@/domain/events/event-schedule";

const UPCOMING_WINDOW_DAYS = 180;

/** Entrée figée : identité + ordre Radar (séances projetées à la lecture). */
export type RadarCommitmentItem = {
  eventId: string;
  score: number;
  planningScore: number;
  reasons: HighlightReason[];
  slot?: HighlightSlot;
  selectionSource?: HighlightSelectionSource;
  aiSelection?: AiHighlightSelectionMeta;
};

export type RadarCommitment = {
  items: RadarCommitmentItem[];
};

/** Slice snapshot nécessaire au hash / à la projection (évite import circulaire). */
export type RadarCommitmentSnapshot = {
  events: DetourEvent[];
  aiShortlist: Array<{
    eventId: string;
    score: number;
    planningScore: number;
    reasons: HighlightReason[];
  }>;
};

export type RadarCommitmentStore = {
  /** HIT → commitment ; MISS → null. Ne doit jamais persister un miss. */
  read(snapshotHash: string): Promise<RadarCommitment | null>;
  /** Persiste uniquement une sélection committable. */
  write(
    snapshotHash: string,
    commitment: RadarCommitment,
  ): Promise<RadarCommitment>;
};

/** Store process-local — tests / chemins hors Data Cache Next. */
export function createMemoryRadarCommitmentStore(): RadarCommitmentStore {
  const store = new Map<string, RadarCommitment>();
  return {
    async read(snapshotHash) {
      return store.get(snapshotHash) ?? null;
    },
    async write(snapshotHash, commitment) {
      store.set(snapshotHash, commitment);
      return commitment;
    },
  };
}

/**
 * Hash du contenu éditorial du snapshot (pas de now).
 * Même corpus + shortlist + séances → même clé de commitment.
 */
export function hashPublicHomeSnapshot(
  snapshot: RadarCommitmentSnapshot,
): string {
  const payload = {
    events: snapshot.events.map((event) => ({
      id: event.id,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay ?? false,
      occurrences: event.occurrences ?? null,
      availabilityStatus: event.availabilityStatus ?? null,
    })),
    aiShortlist: snapshot.aiShortlist,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function isRadarAssessmentCommittable(params: {
  source: AiAssessmentCacheSource;
  assessmentCount: number;
  shortlistSize: number;
}): boolean {
  if (params.shortlistSize <= 0) return false;
  if (params.source !== "cache" && params.source !== "fresh") return false;
  return params.assessmentCount === params.shortlistSize;
}

export function toRadarCommitment(
  highlights: EventHighlight[],
): RadarCommitment {
  return {
    items: highlights.map((highlight) => ({
      eventId: highlight.event.id,
      score: highlight.score,
      planningScore: highlight.planningScore,
      reasons: highlight.reasons,
      ...(highlight.slot ? { slot: highlight.slot } : {}),
      ...(highlight.selectionSource
        ? { selectionSource: highlight.selectionSource }
        : {}),
      ...(highlight.aiSelection
        ? { aiSelection: highlight.aiSelection }
        : {}),
    })),
  };
}

function upcomingWindow(now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);
  return { from, to };
}

/**
 * Projette les séances courantes sur un commitment figé.
 * Event absent ou plus de séance active → retrait sans refill.
 * Nouvelles dates → identité et position conservées.
 */
export function projectRadarCommitment(params: {
  commitment: RadarCommitment;
  events: DetourEvent[];
  now?: Date;
}): EventHighlight[] {
  const now = params.now ?? new Date();
  const window = upcomingWindow(now);
  const eventsById = new Map(
    params.events.map((event) => [event.id, event] as const),
  );

  const projected: EventHighlight[] = [];
  for (const item of params.commitment.items) {
    const event = eventsById.get(item.eventId);
    if (!event) continue;
    const selected = selectEventInWindow(event, { ...window, now });
    if (!selected) continue;
    projected.push({
      event: selected,
      score: item.score,
      planningScore: item.planningScore,
      reasons: item.reasons,
      ...(item.slot ? { slot: item.slot } : {}),
      ...(item.selectionSource
        ? { selectionSource: item.selectionSource }
        : {}),
      ...(item.aiSelection ? { aiSelection: item.aiSelection } : {}),
    });
  }
  return projected;
}
