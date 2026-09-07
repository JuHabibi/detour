import { enrichMapadoAvailability } from "@/application/availability/enrich-mapado-availability";
import { MAPADO_CHECY_TENANT } from "@/infrastructure/ticketing/mapado/mapado-config";
import { listUpcomingActive } from "@/infrastructure/db/event.repository";

const WINDOW_DAYS = 180;

/**
 * Tenants Mapado exécutés par le job (V1 : Chécy seul).
 * Demain : ajouter une entrée de config ici, sans toucher Radar / Explorer.
 */
const MAPADO_TENANTS = [MAPADO_CHECY_TENANT] as const;

export type AvailabilityEnrichmentRunResult = {
  /** Clé historique V1 — résultat du tenant Chécy. */
  mapadoChecy: Awaited<ReturnType<typeof enrichMapadoAvailability>>;
};

/**
 * Job disponibilité séparé du sync OpenAgenda.
 * Best-effort : les erreurs sont renvoyées dans le résumé, pas throwées.
 */
export async function runDetourAvailabilityEnrichment(options?: {
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<AvailabilityEnrichmentRunResult> {
  const from = options?.now ?? new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const events = await listUpcomingActive({ from, to });

  let mapadoChecy: Awaited<ReturnType<typeof enrichMapadoAvailability>> | null =
    null;

  for (const tenant of MAPADO_TENANTS) {
    const result = await enrichMapadoAvailability({
      tenant,
      events,
      dryRun: options?.dryRun ?? false,
      fetchImpl: options?.fetchImpl,
      now: from,
    });
    if (tenant.id === "checy") {
      mapadoChecy = result;
    }
  }

  if (!mapadoChecy) {
    throw new Error("mapado_checy_tenant_missing");
  }

  return { mapadoChecy };
}
