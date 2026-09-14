import posthog from "posthog-js";

/**
 * Instrumentation client Next (composition root navigateur).
 * Init PostHog minimale — pas d’événements métier Détour ici.
 * Désactivé en développement local (évite de polluer la prod).
 * @see docs/architecture.md §13 — app = composition ; métier hors analytics
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md
 */
const isProd = process.env.NODE_ENV === "production";
const posthogKey = isProd
  ? process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  : undefined;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

if (posthogKey) {
  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      defaults: "2026-05-30",
      // Produit Détour = captures explicites uniquement (voir `captureProductEvent`).
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_surveys_automatic_display: true,
      disable_product_tours: true,
      disable_conversations: true,
      // Pas de flags / surveys / remote config replay — coupe l’appel `/flags/`.
      advanced_disable_flags: true,
      rageclick: false,
      capture_heatmaps: false,
      // Web vitals / perf network : non utilisés.
      capture_performance: false,
      opt_in_site_apps: false,
      // Évite le `$set` auto « test user » sur localhost (defaults >= 2026-01-30).
      internal_or_test_user_hostname: null,
    });
  } catch (error) {
    console.error("[detour] PostHog init failed", error);
  }
}

/**
 * Soft navigations Next — pas de `$pageview` automatique ni explicite.
 * Les métriques utiles passent par `radar_event_opened` / `explorer_event_opened` / `filter_changed`.
 */
export function onRouterTransitionStart(_url: string): void {
  // no-op (pageviews désactivés volontairement)
}
