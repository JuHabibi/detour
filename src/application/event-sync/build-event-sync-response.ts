import { runDetourAvailabilityEnrichment } from "@/application/availability/run-detour-availability-enrichment";
import { loadSyncFreshness } from "@/application/event-sync/load-sync-freshness";
import { runDetourEventSync } from "@/application/event-sync/run-detour-event-sync";
import { summarizeSyncRun } from "@/application/event-sync/summarize-sync-run";
import { invalidatePublicEventsCache } from "@/infrastructure/next-public-event-cache";
import { invalidatePublicExplorerCache } from "@/infrastructure/next-public-explorer-cache";
import { invalidatePublicHomeCache } from "@/infrastructure/next-public-home-cache";
import { invalidatePublicWeekendCache } from "@/infrastructure/next-public-weekend-cache";

/**
 * Exécute sync + enrichissement disponibilité (best-effort) et construit la
 * réponse HTTP commune aux routes cron / internal.
 *
 * - `error` / `partial` → HTTP 503 (détectable Vercel Cron / monitoring)
 * - `ok` / `skipped` (busy seul) → HTTP 200
 * - panne Mapado → n’altère pas le statut sync
 */
export async function buildEventSyncResponse(): Promise<Response> {
  try {
    const results = await runDetourEventSync();
    const summary = summarizeSyncRun(results);

    let availability: unknown = null;
    let availabilityError: string | null = null;
    try {
      availability = await runDetourAvailabilityEnrichment();
    } catch (error) {
      availabilityError =
        error instanceof Error
          ? error.message
          : "availability_enrichment_failed";
    }

    const freshness = await loadSyncFreshness({
      adapterIds: results.map((result) => result.adapterId),
    });

    // SWR : tags publics stale — pas de revalidatePath (expire soft tags → hit bloquant).
    invalidatePublicHomeCache();
    invalidatePublicExplorerCache();
    invalidatePublicWeekendCache();
    invalidatePublicEventsCache();

    return Response.json(
      {
        ok: summary.ok,
        status: summary.status,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
        skippedCount: summary.skippedCount,
        results,
        freshness,
        availability,
        availabilityError,
      },
      { status: summary.httpStatus },
    );
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
