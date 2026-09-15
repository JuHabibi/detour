/**
 * Instrumentation temporaire home `/` — à retirer après mesure prod.
 * Préfixe unique : `[home-perf]`
 */
const PREFIX = "[home-perf]";

/** Âge process = proxy cold start instance (sans système de monitoring). */
const processStartedAt = Date.now();

let requestSeq = 0;
let poolCreateMs: number | null = null;
let poolCreatedAt: number | null = null;

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
