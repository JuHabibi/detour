import { syncEventSources } from "@/application/event-sync/sync-event-sources";
import type { SyncResult } from "@/application/event-sync/sync-types";
import { createDetourSyncSources } from "@/infrastructure/create-detour-sync-sources";

const UPCOMING_WINDOW_DAYS = 180;

/**
 * Orchestration Detour → syncEventSources (orleans puis saran).
 * Pas d’auth / HTTP — réservé aux routes.
 */
export async function runDetourEventSync(options?: {
  now?: () => Date;
}): Promise<SyncResult[]> {
  const getNow = options?.now ?? (() => new Date());
  const now = getNow();
  const from = now;
  const to = new Date(now);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  return syncEventSources({
    sources: createDetourSyncSources(),
    from,
    to,
    now: getNow,
  });
}
