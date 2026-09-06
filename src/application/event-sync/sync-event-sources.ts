import { syncEventSource } from "@/application/event-sync/sync-event-source";
import type {
  SyncEventSourcesParams,
  SyncResult,
} from "@/application/event-sync/sync-types";


export async function syncEventSources(
  params: SyncEventSourcesParams,
): Promise<SyncResult[]> {
  const { sources, from, to, now } = params;
  const results: SyncResult[] = [];

  for (const source of sources) {
    try {
      results.push(
        await syncEventSource({
          adapterId: source.adapterId,
          adapter: source.adapter,
          from,
          to,
          now,
        }),
      );
    } catch {
      results.push({
        adapterId: source.adapterId,
        status: "error",
        errorCode: "database_failed",
      });
    }
  }

  return results;
}
