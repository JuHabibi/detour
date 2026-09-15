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

type AuthDbProbe = { ms: number; count: number };

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

/** Exécute `run` en comptant les `query` Pool/Client attribuées à l’auth. */
export async function homePerfWithAuthDbProbe<T>(
  run: () => Promise<T>,
): Promise<{ value: T; dbMs: number; dbQueries: number }> {
  const probe: AuthDbProbe = { ms: 0, count: 0 };
  const value = await authDbProbeAls.run(probe, run);
  return { value, dbMs: probe.ms, dbQueries: probe.count };
}

export function homePerfNoteAuthDbQuery(durationMs: number): void {
  const probe = authDbProbeAls.getStore();
  if (!probe) return;
  probe.count += 1;
  probe.ms += durationMs;
}
