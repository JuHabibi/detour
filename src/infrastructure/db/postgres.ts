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

  const t0 = Date.now();
  pool = new Pool({ connectionString });
  const ms = Date.now() - t0;
  homePerfMarkPoolCreate(ms);
  homePerfLog(
    `pool_create=${ms}ms processAge=${homePerfProcessAgeMs()}ms (Pool ctor only)`,
  );
  return pool;
}

/**
 * Mesure acquisition d’une connexion réelle (réveil Neon / cold TCP).
 * Temporaire — home-perf uniquement.
 */
export async function probePoolConnect(): Promise<number> {
  const t0 = Date.now();
  const client = await getPool().connect();
  try {
    await client.query("select 1");
    return Date.now() - t0;
  } finally {
    client.release();
  }
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
