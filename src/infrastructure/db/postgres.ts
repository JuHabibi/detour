import "server-only";

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import {
  homePerfLog,
  homePerfMarkPoolCreate,
  homePerfProcessAgeMs,
} from "@/infrastructure/db/home-perf";

export type DbQueryable = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => Promise<QueryResult<T>>;
};

let pool: Pool | null = null;

/**
 * Diagnostic temporaire SSL — jamais d’user/password/URL complète.
 * À retirer une fois l’origine du warning pg identifiée.
 */
function logSafeDatabaseUrlMeta(connectionString: string): void {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode") ?? "(absent)";
    const channelBinding =
      url.searchParams.get("channel_binding") ?? "(absent)";
    homePerfLog(
      [
        "db_url_meta",
        `host=${url.hostname}`,
        `sslmode=${sslmode}`,
        `channel_binding=${channelBinding}`,
        `has_POSTGRES_URL=${Boolean(process.env.POSTGRES_URL?.trim())}`,
        `has_DATABASE_URL_UNPOOLED=${Boolean(process.env.DATABASE_URL_UNPOOLED?.trim())}`,
        `PGSSLMODE=${process.env.PGSSLMODE?.trim() || "(absent)"}`,
      ].join(" "),
    );
  } catch {
    homePerfLog("db_url_meta parse_failed");
  }
}

/**
 * Pool process-local, créé au premier usage serveur.
 * DATABASE_URL lue uniquement ici — jamais loggée.
 * SSL / pooler : via la DATABASE_URL du provider (pas de config hardcodée).
 */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  logSafeDatabaseUrlMeta(connectionString);

  const onWarning = (warning: Error) => {
    if (!warning.message.includes("SECURITY WARNING: The SSL modes")) return;
    homePerfLog(
      `pg_ssl_warning_callsite=${warning.stack?.split("\n").slice(0, 8).join(" | ") ?? "(no-stack)"}`,
    );
  };
  process.on("warning", onWarning);

  const t0 = Date.now();
  try {
    pool = new Pool({ connectionString });
  } finally {
    process.off("warning", onWarning);
  }
  const ms = Date.now() - t0;
  homePerfMarkPoolCreate(ms);
  homePerfLog(
    `pool_create=${ms}ms processAge=${homePerfProcessAgeMs()}ms (Pool ctor only)`,
  );
  return pool;
}

/** Pour tests / shutdown éventuel — ne pas appeler en chemin hot. */
export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
