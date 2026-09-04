import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import { CompositeEventSourceAdapter } from "@/infrastructure/composite-event-source.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

/** Source agrégée par défaut — EventService reste agnostique des villes. */
export function createDetourEventSource(): EventSourceAdapter {
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
