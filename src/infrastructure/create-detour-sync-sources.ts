import type { SyncSource } from "@/application/event-sync/sync-types";
import { IngreAgendaEventAdapter } from "@/infrastructure/sources/ingre-agenda/ingre-agenda.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

/**
 * Composition root sync DB — adapters sources bruts, hors composite/cache home.
 * Ajouter une source = une entrée ici, pas dans le moteur de sync.
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
    {
      adapterId: "ingre-agenda",
      adapter: new IngreAgendaEventAdapter(),
    },
  ];
}
