import type { PoolClient } from "pg";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

export type SourceSyncStatus = "ok" | "error";

export type SourceSyncState = {
  adapterId: string;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  status: SourceSyncStatus | null;
  fetchedCount: number;
  errorCode: string | null;
  errorMessageSafe: string | null;
  syncLockToken: string | null;
  syncLockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SourceSyncRow = {
  adapter_id: string;
  last_attempt_at: Date | null;
  last_success_at: Date | null;
  status: string | null;
  fetched_count: number;
  error_code: string | null;
  error_message_safe: string | null;
  sync_lock_token: string | null;
  sync_locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
};

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

function mapSourceSyncRow(row: SourceSyncRow): SourceSyncState {
  const status =
    row.status === "ok" || row.status === "error" ? row.status : null;
  return {
    adapterId: row.adapter_id,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    status,
    fetchedCount: row.fetched_count,
    errorCode: row.error_code,
    errorMessageSafe: row.error_message_safe,
    syncLockToken: row.sync_lock_token,
    syncLockedUntil: row.sync_locked_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureSourceRow(adapterId: string): Promise<void> {
  await getPool().query(
    `
INSERT INTO source_syncs (adapter_id)
VALUES ($1)
ON CONFLICT (adapter_id) DO NOTHING
`.trim(),
    [adapterId],
  );
}

/** Acquire atomique ; true si ce process détient le lease. */
export async function tryAcquireLease(
  adapterId: string,
  token: string,
  lockedUntil: Date,
): Promise<boolean> {
  const result = await getPool().query(
    `
UPDATE source_syncs
SET
  sync_lock_token = $2,
  sync_locked_until = $3,
  last_attempt_at = now(),
  updated_at = now()
WHERE adapter_id = $1
  AND (
    sync_locked_until IS NULL
    OR sync_locked_until < now()
  )
`.trim(),
    [adapterId, token, lockedUntil.toISOString()],
  );
  return (result.rowCount ?? 0) === 1;
}

/** Release uniquement si token propriétaire. */
export async function releaseLease(
  adapterId: string,
  token: string,
): Promise<boolean> {
  const result = await getPool().query(
    `
UPDATE source_syncs
SET
  sync_lock_token = NULL,
  sync_locked_until = NULL,
  updated_at = now()
WHERE adapter_id = $1
  AND sync_lock_token = $2
`.trim(),
    [adapterId, token],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function getSyncState(
  adapterId: string,
  client?: DbQueryable,
): Promise<SourceSyncState | null> {
  const result = await db(client).query<SourceSyncRow>(
    `
SELECT
  adapter_id,
  last_attempt_at,
  last_success_at,
  status,
  fetched_count,
  error_code,
  error_message_safe,
  sync_lock_token,
  sync_locked_until,
  created_at,
  updated_at
FROM source_syncs
WHERE adapter_id = $1
`.trim(),
    [adapterId],
  );
  const row = result.rows[0];
  return row ? mapSourceSyncRow(row) : null;
}

/**
 * Début de tx succès : verrouille la ligne et vérifie ownership + lease vivant.
 * À appeler après BEGIN sur le même client.
 */
export async function lockAndVerifyLease(
  adapterId: string,
  token: string,
  client: PoolClient,
): Promise<boolean> {
  const result = await client.query(
    `
SELECT adapter_id
FROM source_syncs
WHERE adapter_id = $1
  AND sync_lock_token = $2
  AND sync_locked_until IS NOT NULL
  AND sync_locked_until > now()
FOR UPDATE
`.trim(),
    [adapterId, token],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function markSuccess(
  params: {
    adapterId: string;
    token: string;
    fetchedCount: number;
    at: Date;
  },
  client: PoolClient,
): Promise<boolean> {
  const result = await client.query(
    `
UPDATE source_syncs
SET
  last_success_at = $3,
  status = 'ok',
  fetched_count = $4,
  error_code = NULL,
  error_message_safe = NULL,
  sync_lock_token = NULL,
  sync_locked_until = NULL,
  updated_at = now()
WHERE adapter_id = $1
  AND sync_lock_token = $2
  AND sync_locked_until IS NOT NULL
  AND sync_locked_until > now()
`.trim(),
    [
      params.adapterId,
      params.token,
      params.at.toISOString(),
      params.fetchedCount,
    ],
  );
  return (result.rowCount ?? 0) === 1;
}

/** Erreur pré-tx ou en tx — toujours filtré par token si lease détenu. */
export async function markError(
  params: {
    adapterId: string;
    token: string;
    errorCode: string;
    errorMessageSafe: string;
    releaseLease?: boolean;
  },
  client?: DbQueryable,
): Promise<boolean> {
  const release = params.releaseLease ?? true;
  const result = await db(client).query(
    `
UPDATE source_syncs
SET
  status = 'error',
  error_code = $3,
  error_message_safe = $4,
  sync_lock_token = CASE WHEN $5::boolean THEN NULL ELSE sync_lock_token END,
  sync_locked_until = CASE WHEN $5::boolean THEN NULL ELSE sync_locked_until END,
  updated_at = now()
WHERE adapter_id = $1
  AND sync_lock_token = $2
`.trim(),
    [
      params.adapterId,
      params.token,
      params.errorCode,
      params.errorMessageSafe,
      release,
    ],
  );
  return (result.rowCount ?? 0) === 1;
}
