/**
 * Instrumentation client Next (composition root navigateur).
 * PostHog est désactivé temporairement (conformité / consentement) :
 * aucune init SDK, aucun cookie ni localStorage analytics.
 * @see docs/architecture.md §13 — app = composition
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md
 */

/**
 * Soft navigations Next — pas de mesure d’audience automatique.
 * Les appels métier passent par `captureProductEvent` (no-op tant que PostHog est off).
 */
export function onRouterTransitionStart(..._args: [string]): void {
  void _args;
}
