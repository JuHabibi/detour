/**
 * Timings Home durables — préfixe `[home-perf]`.
 * Conservés : public_home, auth_total, favorites, req.
 */

const PREFIX = "[home-perf]";

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
