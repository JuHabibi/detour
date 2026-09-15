import "server-only";

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import {
  homePerfLog,
  homePerfMarkPoolCreate,
  homePerfNoteAuthDbQuery,
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

function instrumentQueryForAuthProbe(
  original: (...args: never[]) => unknown,
): (...args: never[]) => unknown {
  return (...args: never[]) => {
    const t0 = Date.now();
    const result = original(...args);
    if (
      result != null &&
      typeof result === "object" &&
      "then" in result &&
      typeof (result as { then?: unknown }).then === "function"
    ) {
      return Promise.resolve(result).finally(() => {
        homePerfNoteAuthDbQuery(Date.now() - t0);
      });
    }
    homePerfNoteAuthDbQuery(Date.now() - t0);
    return result;
  };
}

function instrumentPoolClient(client: PoolClient): void {
  const marked = client as PoolClient & { __detourAuthProbe?: boolean };
  if (marked.__detourAuthProbe) return;
  marked.__detourAuthProbe = true;
  marked.query = instrumentQueryForAuthProbe(
    marked.query.bind(marked) as (...args: never[]) => unknown,
  ) as typeof marked.query;
}

function instrumentPool(created: Pool): Pool {
  created.query = instrumentQueryForAuthProbe(
    created.query.bind(created) as (...args: never[]) => unknown,
  ) as typeof created.query;

  const originalConnect = created.connect.bind(created);
  created.connect = ((
    callback?: (
      err: Error | undefined,
      client: PoolClient | undefined,
      done: (release?: unknown) => void,
    ) => void,
  ) => {
    if (typeof callback === "function") {
      return originalConnect((err, client, done) => {
        if (client) instrumentPoolClient(client);
        callback(err, client, done);
      });
    }
    return originalConnect().then((client) => {
      instrumentPoolClient(client);
      return client;
    });
  }) as Pool["connect"];

  return created;
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
    pool = instrumentPool(new Pool({ connectionString }));
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
