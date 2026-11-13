import {
  EventService,
  type UpcomingEventsPipeline,
} from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import {
  mapDetourEventToEventItem,
  mapDetourHighlightToEventItem,
} from "@/application/map-detour-event-to-ui";
import {
  createMemoryRadarCommitmentStore,
  hashPublicHomeSnapshot,
  isRadarAssessmentCommittable,
  projectRadarCommitment,
  toRadarCommitment,
  type RadarCommitmentStore,
} from "@/application/home/radar-commitment";
import { getAiConfig } from "@/config/ai-config";
import { shouldExposeHomeDebug } from "@/config/home-debug";
import type { EventItem } from "@/data/types";
import type { DetourEvent } from "@/domain/events/event";
import { isRadarEligibleAvailability } from "@/domain/events/event-availability";
import { selectPlanningEvents } from "@/domain/editorial/select-planning-events";
import {
  rankDetourHighlightCandidates,
  type EventHighlight,
  type HighlightReason,
} from "@/domain/editorial/select-detour-highlights";
import { ingestionFromPlainEvents } from "@/application/ingestion/event-ingestion-result";
import type { AiShortlistBucketStats } from "@/application/ai/build-ai-highlight-shortlist";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import {
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} from "@/infrastructure/ai/next-ai-assessment-cache";
import { createHomeEventSource } from "@/infrastructure/create-detour-event-source";

const UPCOMING_WINDOW_DAYS = 180;

const EMPTY_BUCKET_STATS: AiShortlistBucketStats = {
  "deterministic-top": 0,
  "planning-top": 0,
  "booking-top": 0,
  "peripheral-top": 0,
  "future-top": 0,
};

const eventService = new EventService(
  createHomeEventSource(),
  createHighlightAssessmentProvider(),
  {
    aiConfig: getAiConfig(),
    readThrough: createNextAiAssessmentReadThrough(),
    onForceInvalidate: invalidateNextAiAssessmentCache,
  },
);

/** Read model public Home — aucun user / session / favori ; pas d’Explorer. */
export type PublicHomeData = {
  highlights: EventItem[];
  planningEvents: EventItem[];
  debugEvents?: EventItem[];
  debugMeta?: EventsDebugMeta;
};

export type GetPublicHomeDataParams = {
  from: Date;
  to: Date;
  /** Env-based (pas user). Inclus dans le compute, pas dans une clé user. */
  exposeDebug?: boolean;
};

/** Métadonnées shortlist sans re-embarquer `DetourEvent`. */
export type PublicHomeAiShortlistRef = {
  eventId: string;
  score: number;
  planningScore: number;
  reasons: HighlightReason[];
};

/**
 * Snapshot Home slim — une seule copie du corpus + refs shortlist.
 * Destiné au `unstable_cache` public (limite Data Cache 2 Mo).
 * Sans première page Explorer (chargée sur `/explorer`).
 */
export type PublicHomeSnapshot = {
  events: DetourEvent[];
  aiShortlist: PublicHomeAiShortlistRef[];
  exposeDebug: boolean;
};

export function measurePublicHomeSnapshotBytes(
  snapshot: PublicHomeSnapshot,
): number {
  return Buffer.byteLength(JSON.stringify(snapshot), "utf8");
}

export function toPublicHomeSnapshotSlim(params: {
  events: DetourEvent[];
  aiShortlist: EventHighlight[];
  exposeDebug: boolean;
}): PublicHomeSnapshot {
  return {
    events: params.events,
    aiShortlist: params.aiShortlist.map((item) => ({
      eventId: item.event.id,
      score: item.score,
      planningScore: item.planningScore,
      reasons: item.reasons,
    })),
    exposeDebug: params.exposeDebug,
  };
}

/**
 * Reconstitue le pipeline pour `finalizeUpcomingWithAutoAi`.
 * Ranking déterministe recalculé ; shortlist via ids + métadonnées.
 */
export function reviveUpcomingPipelineFromSlim(
  snapshot: PublicHomeSnapshot,
): UpcomingEventsPipeline {
  const eventsById = new Map(
    snapshot.events.map((event) => [event.id, event] as const),
  );

  const aiShortlist: EventHighlight[] = snapshot.aiShortlist.map((ref) => {
    const event = eventsById.get(ref.eventId);
    if (!event) {
      throw new Error(
        `PublicHomeSnapshot shortlist ref missing event ${ref.eventId}`,
      );
    }
    return {
      event,
      score: ref.score,
      planningScore: ref.planningScore,
      reasons: ref.reasons,
    };
  });

  const radarEligibleEvents = snapshot.events.filter((event) =>
    isRadarEligibleAvailability(event.availabilityStatus),
  );
  const rankedCandidates = rankDetourHighlightCandidates(radarEligibleEvents);
  const highlightCandidates = rankedCandidates.slice(0, 20);

  return {
    ingestion: ingestionFromPlainEvents(snapshot.events),
    rawEvents: snapshot.events,
    classifiedEvents: snapshot.events,
    events: snapshot.events,
    duplicates: [],
    rankedCandidates,
    highlightCandidates,
    aiShortlist,
    aiShortlistInclusion: {},
    aiShortlistBucketSizes: EMPTY_BUCKET_STATS,
  };
}

function toPublicHomeData(params: {
  highlights: EventHighlight[];
  planningEvents: Array<{ event: DetourEvent }>;
  events: DetourEvent[];
  debugMeta?: EventsDebugMeta;
  exposeDebug: boolean;
}): PublicHomeData {
  return {
    highlights: params.highlights.map((highlight) =>
      mapDetourHighlightToEventItem(highlight),
    ),
    planningEvents: params.planningEvents.map((item) =>
      mapDetourEventToEventItem(item.event),
    ),
    debugEvents: params.exposeDebug
      ? params.events.map((event) => mapDetourEventToEventItem(event))
      : undefined,
    debugMeta: params.exposeDebug ? params.debugMeta : undefined,
  };
}

/**
 * Compute Home slim sans IA — destiné au callback `unstable_cache` public.
 * Radar / planning uniquement — pas d’Explorer.
 */
export async function getPublicHomeSnapshot(
  params: GetPublicHomeDataParams,
): Promise<PublicHomeSnapshot> {
  const exposeDebug = params.exposeDebug ?? shouldExposeHomeDebug();

  const pipeline = await eventService.buildUpcomingPipeline({
    from: params.from,
    to: params.to,
  });

  return toPublicHomeSnapshotSlim({
    events: pipeline.events,
    aiShortlist: pipeline.aiShortlist,
    exposeDebug,
  });
}

export type MaterializePublicHomeDataOptions = {
  now?: Date;
  /**
   * Persistance identité/ordre Radar (Data Cache Next en prod).
   * Défaut mémoire process — les loaders cache injectent le store Next.
   */
  commitmentStore?: RadarCommitmentStore;
  /** Injection tests — défaut : EventService module. */
  finalizeUpcomingWithAutoAi?: (
    pipeline: UpcomingEventsPipeline,
  ) => ReturnType<EventService["finalizeUpcomingWithAutoAi"]>;
};

/**
 * Assessment IA + mapping UI — **hors** scope `unstable_cache` Home snapshot.
 *
 * Radar commitment-first :
 * 1. Lire un commitment existant (skip IA si HIT)
 * 2. Sinon finalize IA ; écrire seulement si assessments committables
 * 3. Projeter les séances (`now`) : drop sans refill, dates à jour
 *
 * Planning : rejoué au HIT avec les `aiAssessments` figés au commit
 * (pas de nouvel appel provider ; règles `selectPlanningEvents` inchangées).
 */
export async function materializePublicHomeData(
  snapshot: PublicHomeSnapshot,
  options: MaterializePublicHomeDataOptions = {},
): Promise<PublicHomeData> {
  const now = options.now ?? new Date();
  const commitmentStore =
    options.commitmentStore ?? createMemoryRadarCommitmentStore();
  const finalize =
    options.finalizeUpcomingWithAutoAi ??
    ((pipeline: UpcomingEventsPipeline) =>
      eventService.finalizeUpcomingWithAutoAi(pipeline));
  const snapshotHash = hashPublicHomeSnapshot(snapshot);

  const existing = await commitmentStore.read(snapshotHash);
  if (existing) {
    const highlights = projectRadarCommitment({
      commitment: existing,
      events: snapshot.events,
      now,
    });
    const pipeline = reviveUpcomingPipelineFromSlim(snapshot);
    const planningEvents = selectPlanningEvents({
      events: snapshot.events,
      aiAssessments: existing.aiAssessments,
      excludedEventIds: highlights.map((item) => item.event.id),
      deterministicCandidates: pipeline.rankedCandidates,
      now,
    });
    return toPublicHomeData({
      highlights,
      planningEvents,
      events: snapshot.events,
      exposeDebug: snapshot.exposeDebug,
    });
  }

  // Miss : sélection éditoriale sur le snapshot figé (pas de re-filtre temporel
  // du corpus — la projection post-sélection gère les séances expirées).
  const pipeline = reviveUpcomingPipelineFromSlim(snapshot);
  const result = await finalize(pipeline);

  const commitment = toRadarCommitment(
    result.highlights,
    result.aiAssessments,
  );
  if (
    isRadarAssessmentCommittable({
      source: result.aiMeta.source,
      assessmentCount: result.aiAssessments.length,
      shortlistSize: snapshot.aiShortlist.length,
    })
  ) {
    try {
      await commitmentStore.write(snapshotHash, commitment);
    } catch (error) {
      console.error("[detour] radar commitment write failed", error);
    }
  }

  const highlights = projectRadarCommitment({
    commitment,
    events: snapshot.events,
    now,
  });
  // Même formule que le HIT : assessments du commit + now explicite
  // (évite l’écart avec `result.planningEvents` qui utilise `Date.now()` interne).
  const planningEvents = selectPlanningEvents({
    events: snapshot.events,
    aiAssessments: commitment.aiAssessments,
    excludedEventIds: highlights.map((item) => item.event.id),
    deterministicCandidates: pipeline.rankedCandidates,
    now,
  });

  return toPublicHomeData({
    highlights,
    planningEvents,
    events: result.events,
    debugMeta: snapshot.exposeDebug ? buildEventsDebugMeta(result) : undefined,
    exposeDebug: snapshot.exposeDebug,
  });
}

/**
 * Charge Radar + planning pour la Home.
 * Page-loader helper — pas de données authentifiées ni d’Explorer.
 */
export async function getPublicHomeData(
  params: GetPublicHomeDataParams,
): Promise<PublicHomeData> {
  return materializePublicHomeData(await getPublicHomeSnapshot(params));
}

/** Fenêtre calendaire alignée sur loadHomePage historique. */
export function publicHomeUpcomingWindow(now: Date = new Date()): {
  from: Date;
  to: Date;
} {
  const from = new Date(now);
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);
  return { from, to };
}
