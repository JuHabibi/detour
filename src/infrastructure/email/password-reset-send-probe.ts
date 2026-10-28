import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Sonde par requête : Better Auth 1.7.4 avale les erreurs de
 * `sendResetPassword` dans `runInBackgroundOrAwait`. On marque l’échec ici
 * pour que le wrapper de route puisse renvoyer une erreur ops explicite.
 */
export type PasswordResetSendProbe = {
  failed: boolean;
};

export const passwordResetSendProbe =
  new AsyncLocalStorage<PasswordResetSendProbe>();

/** Circuit breaker process-local : après un échec Resend, 503 uniforme. */
const COOLDOWN_MS = 30_000;
let unavailableUntilMs = 0;

export function markPasswordResetProviderUnavailable(
  nowMs: number = Date.now(),
): void {
  unavailableUntilMs = Math.max(unavailableUntilMs, nowMs + COOLDOWN_MS);
}

export function isPasswordResetProviderInCooldown(
  nowMs: number = Date.now(),
): boolean {
  return nowMs < unavailableUntilMs;
}

/** Tests uniquement. */
export function resetPasswordResetProviderCooldownForTests(): void {
  unavailableUntilMs = 0;
}
