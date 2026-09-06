import type { SyncSource } from "@/application/event-sync/sync-types";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

/**
 * Composition root sync DB — adapters sources bruts, hors composite/cache home.
 * Ajouter Ingré = une entrée supplémentaire ici, pas dans le moteur C.
 */
export function createDetourSyncSources(): SyncSource[] {
  return [
    {
      adapterId: "orleans",
      adapter: new OrleansEventAdapter(),
    },
    {
      adapterId: "saran",
      adapter: new SaranEventAdapter(),
    },
  ];
}
