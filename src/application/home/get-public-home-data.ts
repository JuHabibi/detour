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
import type {
  EventIngestionResult,
  SourceIngestionStatus,
} from "@/application/ingestion/event-ingestion-result";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import {
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} from "@/infrastructure/ai/next-ai-assessment-cache";
import { createHomeEventSource } from "@/infrastructure/create-detour-event-source";

const UPCOMING_WINDOW_DAYS = 180;

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

/** Ingestion JSON-safe pour Data Cache Home (Maps → records). */
type SerializedIngestion = {
  events: EventIngestionResult["events"];
  adapterByEventId: Record<string, string>;
  rawCountByAdapter: Record<string, number>;
  statusByAdapter: Record<string, SourceIngestionStatus>;
  sourceNameByAdapter: Record<string, string>;
  adapterOrder: string[];
};

type SerializablePipeline = Omit<UpcomingEventsPipeline, "ingestion"> & {
  ingestion: SerializedIngestion;
};

/**
 * Snapshot Home **sans** assessment IA — seul contenu du `unstable_cache` Home.
 * L’IA est matérialisée après, hors scope nesté.
 */
export type PublicHomeSnapshot = {
  pipeline: SerializablePipeline;
  explorerPage: ListExplorerEventsResult;
  exposeDebug: boolean;
};

function serializeIngestion(
  ingestion: EventIngestionResult,
): SerializedIngestion {
  return {
    events: ingestion.events,
    adapterByEventId: Object.fromEntries(ingestion.adapterByEventId),
    rawCountByAdapter: Object.fromEntries(ingestion.rawCountByAdapter),
    statusByAdapter: Object.fromEntries(ingestion.statusByAdapter),
    sourceNameByAdapter: Object.fromEntries(ingestion.sourceNameByAdapter),
    adapterOrder: ingestion.adapterOrder,
  };
}

function revivePipeline(pipeline: SerializablePipeline): UpcomingEventsPipeline {
  return {
    ...pipeline,
    ingestion: {
      events: pipeline.ingestion.events,
      adapterByEventId: new Map(
        Object.entries(pipeline.ingestion.adapterByEventId),
      ),
      rawCountByAdapter: new Map(
        Object.entries(pipeline.ingestion.rawCountByAdapter),
      ),
      statusByAdapter: new Map(
        Object.entries(pipeline.ingestion.statusByAdapter),
      ),
      sourceNameByAdapter: new Map(
        Object.entries(pipeline.ingestion.sourceNameByAdapter),
      ),
      adapterOrder: pipeline.ingestion.adapterOrder,
    },
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
 * Compute Home sans IA — destiné au callback `unstable_cache` public.
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

  return {
    pipeline: {
      ...pipeline,
      ingestion: serializeIngestion(pipeline.ingestion),
    },
    explorerPage,
    exposeDebug,
  };
}

/**
 * Assessment IA + mapping UI — **hors** scope `unstable_cache` Home.
 */
export async function materializePublicHomeData(
  snapshot: PublicHomeSnapshot,
): Promise<PublicHomeData> {
  const result = await eventService.finalizeUpcomingWithAutoAi(
    revivePipeline(snapshot.pipeline),
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
