/**
 * Instrumentation home `/` — timings auth / cache / SQL.
 * Préfixe unique : `[home-perf]`
 */
import { AsyncLocalStorage } from "node:async_hooks";

const PREFIX = "[home-perf]";

/** Âge process = proxy cold start instance (sans système de monitoring). */
const processStartedAt = Date.now();

let requestSeq = 0;
let poolCreateMs: number | null = null;
let poolCreatedAt: number | null = null;

export type AuthDbQueryKind = "find_session" | "update_session" | "other";

type AuthDbProbe = {
  queryMs: number;
  queryCount: number;
  connectMs: number;
  connectCount: number;
  sawUpdateSession: boolean;
};

/** Scope requête auth uniquement — ignore le SQL Home parallèle. */
const authDbProbeAls = new AsyncLocalStorage<AuthDbProbe>();

export function homePerfProcessAgeMs(): number {
  return Date.now() - processStartedAt;
}

export function homePerfMarkPoolCreate(ms: number): void {
  poolCreateMs = ms;
  poolCreatedAt = Date.now();
}

export function homePerfPoolMeta(): {
  poolCreateMs: number | null;
  poolAgeMs: number | null;
} {
  return {
    poolCreateMs,
    poolAgeMs:
      poolCreatedAt == null ? null : Date.now() - poolCreatedAt,
  };
}

export function homePerfNextReqId(): string {
  requestSeq += 1;
  return `${processStartedAt.toString(36)}-r${requestSeq}`;
}

export function homePerfLog(message: string): void {
  console.info(`${PREFIX} ${message}`);
}

export async function homePerfTimed<T>(
  run: () => Promise<T>,
): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await run();
  return { value, ms: Date.now() - t0 };
}

/**
 * Classe le SQL auth sans loguer le texte ni les params.
 * Uniquement des patterns de verbe + table (requêtes paramétrées BA/Kysely).
 */
export function classifyAuthSqlQuery(sql: string): AuthDbQueryKind {
  const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return "other";

  const touchesSession =
    /\bfrom\s+"?session"?\b/.test(normalized) ||
    /\bupdate\s+"?session"?\b/.test(normalized) ||
    /\binto\s+"?session"?\b/.test(normalized) ||
    /\bjoin\s+"?session"?\b/.test(normalized) ||
    // sous-requête Kysely : selectFrom(session) as primary
    /\bfrom\s+"?session"?\s+as\b/.test(normalized);

  if (/\bupdate\s+"?session"?\b/.test(normalized)) {
    return "update_session";
  }
  if (/\bselect\b/.test(normalized) && touchesSession) {
    return "find_session";
  }
  return "other";
}

/** Extrait le texte SQL du 1er argument `pg` (string | { text }) — jamais les values. */
export function extractPgQueryText(queryArg: unknown): string | null {
  if (typeof queryArg === "string") return queryArg;
  if (
    queryArg &&
    typeof queryArg === "object" &&
    "text" in queryArg &&
    typeof (queryArg as { text: unknown }).text === "string"
  ) {
    return (queryArg as { text: string }).text;
  }
  return null;
}

export type AuthDbProbeResult<T> = {
  value: T;
  dbMs: number;
  dbQueries: number;
  connectMs: number;
  connectCount: number;
  sessionRefresh: boolean;
};

/** Exécute `run` en mesurant connect + query attribués à l’auth. */
export async function homePerfWithAuthDbProbe<T>(
  run: () => Promise<T>,
): Promise<AuthDbProbeResult<T>> {
  const probe: AuthDbProbe = {
    queryMs: 0,
    queryCount: 0,
    connectMs: 0,
    connectCount: 0,
    sawUpdateSession: false,
  };
  const value = await authDbProbeAls.run(probe, run);
  return {
    value,
    dbMs: probe.queryMs,
    dbQueries: probe.queryCount,
    connectMs: probe.connectMs,
    connectCount: probe.connectCount,
    sessionRefresh: probe.sawUpdateSession,
  };
}

export function homePerfNoteAuthDbConnect(durationMs: number): void {
  const probe = authDbProbeAls.getStore();
  if (!probe) return;
  probe.connectCount += 1;
  probe.connectMs += durationMs;
}

export function homePerfNoteAuthDbQuery(
  durationMs: number,
  kind: AuthDbQueryKind = "other",
): void {
  const probe = authDbProbeAls.getStore();
  if (!probe) return;
  probe.queryCount += 1;
  probe.queryMs += durationMs;
  if (kind === "update_session") {
    probe.sawUpdateSession = true;
  }
  homePerfLog(`auth_db_query kind=${kind} duration=${durationMs}ms`);
}
