import type { SyncSource } from "@/application/event-sync/sync-types";
import { BouillonEventAdapter } from "@/infrastructure/sources/bouillon/bouillon.adapter";
import { IngreAgendaEventAdapter } from "@/infrastructure/sources/ingre-agenda/ingre-agenda.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

/**
 * Composition root sync DB — adapters sources bruts, hors composite/cache home.
 * Ajouter une source = une entrée ici, pas dans le moteur de sync.
 *
 * Ormes (`OrmesEventAdapter`) est conservé hors sync : ville-ormes.fr sert un
 * challenge anti-bot depuis Vercel. Réactivation = ré-ajouter l’entrée ici.
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
    {
      adapterId: "bouillon",
      adapter: new BouillonEventAdapter(),
    },
  ];
}
