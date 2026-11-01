import type { SyncResult } from "@/application/event-sync/sync-types";

/**
 * Cron quotidien 05:00 UTC → seuil > 36 h = au moins un créneau manqué
 * (ou jamais de succès), sans alerter pour un simple retard de quelques heures.
 */
export const SYNC_FRESHNESS_STALE_AFTER_MS = 36 * 60 * 60 * 1000;

/** Statut global d’un run multi-sources (indépendant de la disponibilité Mapado). */
export type SyncRunStatus = "ok" | "partial" | "error" | "skipped";

export type SyncRunSummary = {
  status: SyncRunStatus;
  /** true seulement si aucune source en `error` (busy/skipped OK). */
  ok: boolean;
  /** 200 si ok/skipped ; 503 si partial/error (visible Vercel Cron). */
  httpStatus: 200 | 503;
  successCount: number;
  errorCount: number;
  skippedCount: number;
};

export type SyncFreshnessKind = "fresh" | "stale" | "never_succeeded";

export type SyncFreshnessEntry = {
  adapterId: string;
  lastSuccessAt: string | null;
  freshness: SyncFreshnessKind;
};

/**
 * Agrège les SyncResult d’un run.
 * `busy` / `lost_lease` → skipped, jamais une panne automatique.
 */
export function summarizeSyncRun(results: SyncResult[]): SyncRunSummary {
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const result of results) {
    if (result.status === "success") successCount += 1;
    else if (result.status === "error") errorCount += 1;
    else skippedCount += 1;
  }

  let status: SyncRunStatus;
  if (errorCount > 0 && successCount > 0) status = "partial";
  else if (errorCount > 0) status = "error";
  else if (successCount === 0 && skippedCount > 0) status = "skipped";
  else status = "ok";

  const ok = errorCount === 0;
  const httpStatus: 200 | 503 = ok ? 200 : 503;

  return {
    status,
    ok,
    httpStatus,
    successCount,
    errorCount,
    skippedCount,
  };
}

export function classifySourceFreshness(
  lastSuccessAt: Date | null,
  now: Date,
  staleAfterMs: number = SYNC_FRESHNESS_STALE_AFTER_MS,
): SyncFreshnessKind {
  if (lastSuccessAt == null) return "never_succeeded";
  const ageMs = now.getTime() - lastSuccessAt.getTime();
  if (ageMs > staleAfterMs) return "stale";
  return "fresh";
}

/**
 * Rapport de fraîcheur pour les adapters du run, à partir de `source_syncs`.
 * Une entrée par adapter demandé (état absent → never_succeeded).
 */
export function buildSyncFreshnessReport(params: {
  adapterIds: string[];
  lastSuccessByAdapter: Map<string, Date | null>;
  now: Date;
  staleAfterMs?: number;
}): SyncFreshnessEntry[] {
  const staleAfterMs =
    params.staleAfterMs ?? SYNC_FRESHNESS_STALE_AFTER_MS;

  return params.adapterIds.map((adapterId) => {
    const lastSuccessAt = params.lastSuccessByAdapter.has(adapterId)
      ? (params.lastSuccessByAdapter.get(adapterId) ?? null)
      : null;
    return {
      adapterId,
      lastSuccessAt: lastSuccessAt ? lastSuccessAt.toISOString() : null,
      freshness: classifySourceFreshness(
        lastSuccessAt,
        params.now,
        staleAfterMs,
      ),
    };
  });
}
