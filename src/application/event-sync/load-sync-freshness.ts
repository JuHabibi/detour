import {
  buildSyncFreshnessReport,
  type SyncFreshnessEntry,
} from "@/application/event-sync/summarize-sync-run";
import { listSourceSyncStates } from "@/infrastructure/db/source-sync.repository";

/**
 * Charge la fraîcheur post-run depuis `source_syncs` (best-effort).
 * Échec DB → null : ne masque pas le statut du run.
 */
export async function loadSyncFreshness(params: {
  adapterIds: string[];
  now?: Date;
}): Promise<SyncFreshnessEntry[] | null> {
  try {
    const states = await listSourceSyncStates(params.adapterIds);
    const lastSuccessByAdapter = new Map<string, Date | null>();
    for (const state of states) {
      lastSuccessByAdapter.set(state.adapterId, state.lastSuccessAt);
    }
    return buildSyncFreshnessReport({
      adapterIds: params.adapterIds,
      lastSuccessByAdapter,
      now: params.now ?? new Date(),
    });
  } catch {
    return null;
  }
}
