/**
 * Délais HTTP par requête (B2 itération 1).
 * Couvrent fetch + lecture du corps via `AbortSignal.timeout`.
 */
export const SOURCE_HTTP_TIMEOUT_MS = 15_000;
export const AI_HTTP_TIMEOUT_MS = 30_000;

/** Abort / timeout natifs (`AbortSignal.timeout`, `AbortController`). */
export function isAbortOrTimeoutError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name: unknown }).name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

/**
 * Ajoute un délai d’abort au `RequestInit` sans écraser un signal appelant.
 * Le signal reste actif pendant `response.text()` / `response.json()`.
 */
export function withHttpTimeout(
  timeoutMs: number,
  init?: RequestInit,
): RequestInit {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const existing = init?.signal;
  if (!existing) {
    return { ...init, signal: timeoutSignal };
  }
  return { ...init, signal: AbortSignal.any([existing, timeoutSignal]) };
}
