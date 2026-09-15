import {
  EventService,
  type UpcomingEventsPipeline,
} from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import type { ListExplorerEventsResult } from "@/application/explorer/types";
import {
  mapDetourEventToEventItem,
  mapDetourHighlightToEventItem,
} from "@/application/map-detour-event-to-ui";
import { getAiConfig } from "@/config/ai-config";
import { shouldExposeHomeDebug } from "@/config/home-debug";
import type { EventItem } from "@/data/types";
import type { DetourEvent } from "@/domain/events/event";
import { isRadarEligibleAvailability } from "@/domain/events/event-availability";
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

/** Read model public Home — aucun user / session / favori. */
export type PublicHomeData = {
  highlights: EventItem[];
  planningEvents: EventItem[];
  explorer: {
    events: EventItem[];
    totalCount: number;
    nextCursor: string | null;
  };
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
 */
export type PublicHomeSnapshot = {
  events: DetourEvent[];
  aiShortlist: PublicHomeAiShortlistRef[];
  explorerPage: ListExplorerEventsResult;
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
  explorerPage: ListExplorerEventsResult;
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
    explorerPage: params.explorerPage,
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

function toPublicHomeData(
  result: Awaited<ReturnType<EventService["finalizeUpcomingWithAutoAi"]>>,
  explorerPage: ListExplorerEventsResult,
  exposeDebug: boolean,
): PublicHomeData {
  return {
    highlights: result.highlights.map((highlight) =>
      mapDetourHighlightToEventItem(highlight),
    ),
    planningEvents: result.planningEvents.map((item) =>
      mapDetourEventToEventItem(item.event),
    ),
    explorer: {
      events: explorerPage.events.map((event) =>
        mapDetourEventToEventItem(event),
      ),
      totalCount: explorerPage.totalCount,
      nextCursor: explorerPage.nextCursor,
    },
    debugEvents: exposeDebug
      ? result.events.map((event) => mapDetourEventToEventItem(event))
      : undefined,
    debugMeta: exposeDebug ? buildEventsDebugMeta(result) : undefined,
  };
}

/**
 * Compute Home slim sans IA — destiné au callback `unstable_cache` public.
 */
export async function getPublicHomeSnapshot(
  params: GetPublicHomeDataParams,
): Promise<PublicHomeSnapshot> {
  const exposeDebug = params.exposeDebug ?? shouldExposeHomeDebug();

  const [pipeline, explorerPage] = await Promise.all([
    eventService.buildUpcomingPipeline({
      from: params.from,
      to: params.to,
    }),
    listExplorerEvents({ when: "weekend", limit: 12 }),
  ]);

  const snapshot = toPublicHomeSnapshotSlim({
    events: pipeline.events,
    aiShortlist: pipeline.aiShortlist,
    explorerPage,
    exposeDebug,
  });

  return snapshot;
}

/**
 * Assessment IA + mapping UI — **hors** scope `unstable_cache` Home.
 */
export async function materializePublicHomeData(
  snapshot: PublicHomeSnapshot,
): Promise<PublicHomeData> {
  const result = await eventService.finalizeUpcomingWithAutoAi(
    reviveUpcomingPipelineFromSlim(snapshot),
  );
  return toPublicHomeData(result, snapshot.explorerPage, snapshot.exposeDebug);
}

/**
 * Charge Radar + planning + Explorer initial pour la Home.
 * Page-loader helper — pas de données authentifiées.
 * (IA incluse — pour appels hors cache Home nesté.)
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
