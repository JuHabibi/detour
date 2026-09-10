"use client";

import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

/** Capture produit UI — no-op si PostHog non configuré. */
export function captureProductEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!posthogKey) return;
  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.error("[detour] PostHog capture failed", error);
  }
}
