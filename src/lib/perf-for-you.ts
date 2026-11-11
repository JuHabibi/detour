/**
 * Chronos « Pour vous » — logs console en développement uniquement.
 * Aucun effet en production ; pas de données personnelles dans les labels.
 */

const ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.DETOUR_PERF_FOR_YOU === "1";

type PerfMark = {
  label: string;
  t0: number;
};

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function forYouPerfEnabled(): boolean {
  return ENABLED;
}

export function forYouPerfMark(label: string): PerfMark {
  return { label, t0: nowMs() };
}

export function forYouPerfEnd(
  mark: PerfMark,
  extra?: Record<string, string | number | boolean | null | undefined>,
): number {
  const ms = Math.round((nowMs() - mark.t0) * 10) / 10;
  if (!ENABLED) return ms;
  const suffix = extra
    ? " " +
      Object.entries(extra)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ")
    : "";
  console.info(`[detour:perf:for-you] ${mark.label} ${ms}ms${suffix}`);
  return ms;
}

export function forYouPerfLog(
  message: string,
  extra?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!ENABLED) return;
  const suffix = extra
    ? " " +
      Object.entries(extra)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ")
    : "";
  console.info(`[detour:perf:for-you] ${message}${suffix}`);
}
