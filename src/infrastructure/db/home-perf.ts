/**
 * Timings Home — préfixe `[detour:home-perf]`.
 * Serveur : public_home hit/miss, auth, favorites, req.
 * Client : voir HomePage (session / favorites hydration).
 */

const PREFIX = "[detour:home-perf]";

let requestSeq = 0;
const processStartedAt = Date.now();

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
