import { resolveDetourEventSourceMode } from "@/config/event-source-config";
import type { EventSource } from "@/application/ports/event-source";
import { CompositeEventSourceAdapter } from "@/infrastructure/composite-event-source.adapter";
import {
  wrapWithIngestionCache,
  type IngestionReadThrough,
} from "@/infrastructure/ingestion-cache";
import { createNextIngestionReadThrough } from "@/infrastructure/next-ingestion-cache";
import { DatabaseEventSourceAdapter } from "@/infrastructure/sources/database/database-event-source.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

/** Source agrégée brute — sans cache (tests adapters / scripts de mesure bruts). */
export function createDetourEventSource(): EventSource {
  return new CompositeEventSourceAdapter([
    {
      name: "orleans",
      label: "Orléans / OpenAgenda",
      adapter: new OrleansEventAdapter(),
    },
    {
      name: "saran",
      label: "Ville de Saran",
      adapter: new SaranEventAdapter(),
    },
  ]);
}

/**
 * Source home / actions : ingestion Orléans+Saran derrière un read-through
 * (Next Data Cache ou mémoire). Le ranking / IA restent hors de ce cache.
 */
export function createCachedDetourEventSource(
  readThrough: IngestionReadThrough,
): EventSource {
  return wrapWithIngestionCache(createDetourEventSource(), readThrough);
}

/**
 * Point unique home / actions IA.
 * Mode database : lecture PG uniquement (pas de composite/cache live).
 * Mode live : construit le chemin cached seulement après résolution du flag.
 */
export function createHomeEventSource(): EventSource {
  const mode = resolveDetourEventSourceMode();
  if (mode === "database") {
    return new DatabaseEventSourceAdapter();
  }
  return createCachedDetourEventSource(createNextIngestionReadThrough());
}
