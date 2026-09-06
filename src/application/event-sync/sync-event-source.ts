import {
  countActiveByAdapter,
  deactivateNotSeenSince,
  upsertMany,
} from "@/infrastructure/db/event.repository";
import { getPool } from "@/infrastructure/db/postgres";
import {
  ensureSourceRow,
  lockAndVerifyLease,
  markError,
  markSuccess,
  tryAcquireLease,
} from "@/infrastructure/db/source-sync.repository";
import {
  SYNC_ERROR_MESSAGE_SAFE,
  SYNC_LEASE_TTL_MS,
  type SyncErrorCode,
  type SyncEventSourceParams,
  type SyncResult,
} from "@/application/event-sync/sync-types";

async function safeMarkError(params: {
  adapterId: string;
  token: string;
  errorCode: SyncErrorCode;
}): Promise<void> {
  try {
    await markError({
      adapterId: params.adapterId,
      token: params.token,
      errorCode: params.errorCode,
      errorMessageSafe: SYNC_ERROR_MESSAGE_SAFE[params.errorCode],
      releaseLease: true,
    });
  } catch {
    // Lease expirera ; ne pas écraser un autre propriétaire.
  }
}

function errorResult(
  adapterId: string,
  errorCode: SyncErrorCode,
): SyncResult {
  return { adapterId, status: "error", errorCode };
}

/**
 * Synchronise une source externe vers PostgreSQL (lease + fetch hors tx + tx courte).
 * Ne remonte jamais d’erreur brute — toujours un SyncResult.
 */
export async function syncEventSource(
  params: SyncEventSourceParams,
): Promise<SyncResult> {
  const { adapterId, adapter, from, to } = params;
  const getNow = params.now ?? (() => new Date());

  let token: string | null = null;
  let leaseAcquired = false;

  try {
    const startedAt = getNow();
    const lockedUntil = new Date(startedAt.getTime() + SYNC_LEASE_TTL_MS);

    try {
      await ensureSourceRow(adapterId);
    } catch {
      return errorResult(adapterId, "database_failed");
    }

    token = crypto.randomUUID();

    let acquired: boolean;
    try {
      acquired = await tryAcquireLease(adapterId, token, lockedUntil);
    } catch {
      // UPDATE potentiellement appliqué malgré réponse perdue → best effort token-scoped.
      await safeMarkError({
        adapterId,
        token,
        errorCode: "database_failed",
      });
      return errorResult(adapterId, "database_failed");
    }

    if (!acquired) {
      return { adapterId, status: "skipped", reason: "busy" };
    }
    leaseAcquired = true;

    let fetchedEvents;
    try {
      fetchedEvents = await adapter.fetchUpcomingEvents({ from, to });
    } catch {
      await safeMarkError({
        adapterId,
        token,
        errorCode: "fetch_failed",
      });
      return errorResult(adapterId, "fetch_failed");
    }

    let previousActiveCount: number;
    try {
      previousActiveCount = await countActiveByAdapter(adapterId);
    } catch {
      await safeMarkError({
        adapterId,
        token,
        errorCode: "database_failed",
      });
      return errorResult(adapterId, "database_failed");
    }

    if (previousActiveCount > 0 && fetchedEvents.length === 0) {
      await safeMarkError({
        adapterId,
        token,
        errorCode: "empty_corpus",
      });
      return errorResult(adapterId, "empty_corpus");
    }

    const syncMarker = getNow();
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      const leaseOk = await lockAndVerifyLease(adapterId, token, client);
      if (!leaseOk) {
        await client.query("ROLLBACK");
        return { adapterId, status: "skipped", reason: "lost_lease" };
      }

      try {
        await upsertMany(adapterId, fetchedEvents, syncMarker, client);
        const deactivatedCount = await deactivateNotSeenSince(
          adapterId,
          syncMarker,
          client,
        );
        const successAt = getNow();
        const marked = await markSuccess(
          {
            adapterId,
            token,
            fetchedCount: fetchedEvents.length,
            at: successAt,
          },
          client,
        );

        if (!marked) {
          await client.query("ROLLBACK");
          await safeMarkError({
            adapterId,
            token,
            errorCode: "transaction_failed",
          });
          return errorResult(adapterId, "transaction_failed");
        }

        await client.query("COMMIT");
        leaseAcquired = false;
        return {
          adapterId,
          status: "success",
          fetchedCount: fetchedEvents.length,
          deactivatedCount,
        };
      } catch {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback failure
        }
        await safeMarkError({
          adapterId,
          token,
          errorCode: "transaction_failed",
        });
        return errorResult(adapterId, "transaction_failed");
      }
    } catch {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      await safeMarkError({
        adapterId,
        token,
        errorCode: "database_failed",
      });
      return errorResult(adapterId, "database_failed");
    } finally {
      client.release();
    }
  } catch {
    if (leaseAcquired && token) {
      await safeMarkError({
        adapterId,
        token,
        errorCode: "database_failed",
      });
    }
    return errorResult(adapterId, "database_failed");
  }
}
