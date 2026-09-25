import type { SyncSource } from "@/application/event-sync/sync-types";
import { BouillonEventAdapter } from "@/infrastructure/sources/bouillon/bouillon.adapter";
import { IngreAgendaEventAdapter } from "@/infrastructure/sources/ingre-agenda/ingre-agenda.adapter";
import { IngreMediathequeEventAdapter } from "@/infrastructure/sources/ingre-mediatheque/ingre-mediatheque.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaintJeanLeBlancEventAdapter } from "@/infrastructure/sources/saint-jean-le-blanc/saint-jean-le-blanc.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

/**
 * Composition root sync DB — adapters sources bruts, hors composite/cache home.
 * Ajouter une source = une entrée ici, pas dans le moteur de sync.
 *
 * Hors sync volontaire :
 * - Ormes : ville-ormes.fr sert un challenge anti-bot depuis Vercel.
 * - `ingre-mediatheque` : adapter prêt ; activation = ré-ajouter
 *   `{ adapterId: "ingre-mediatheque", adapter: new IngreMediathequeEventAdapter() }`
 *   (sinon le prochain cron prod l’ingérerait dès le déploiement).
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
    {
      adapterId: "saint-jean-le-blanc",
      adapter: new SaintJeanLeBlancEventAdapter(),
    },
  ];
}

/** Réexport pour activation / dry-run manuels sans l’enregistrer au sync. */
export { IngreMediathequeEventAdapter };
