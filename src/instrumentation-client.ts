import posthog from "posthog-js";

/**
 * Instrumentation client Next (composition root navigateur).
 * Init PostHog minimale — pas d’événements métier Détour ici.
 * @see docs/architecture.md §13 — app = composition ; métier hors analytics
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

if (posthogKey) {
  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      // Snapshot de config SDK recommandé par PostHog (pageviews / sessions).
      defaults: "2026-05-30",
    });
  } catch (error) {
    console.error("[detour] PostHog init failed", error);
  }
}

/** Pageviews sur navigations App Router (après le $pageview initial du SDK). */
export function onRouterTransitionStart(url: string): void {
  if (!posthogKey) return;
  try {
    posthog.capture("$pageview", {
      $current_url: url,
    });
  } catch (error) {
    console.error("[detour] PostHog pageview failed", error);
  }
}
