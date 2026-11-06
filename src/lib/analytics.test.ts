import { describe, expect, it, vi } from "vitest";
import { captureProductEvent } from "@/lib/analytics";

describe("captureProductEvent (PostHog désactivé)", () => {
  it("ne lève pas et ignore les propriétés", () => {
    expect(() =>
      captureProductEvent("radar_event_opened", {
        event_id: "openagenda:1",
        city: "Orléans",
      }),
    ).not.toThrow();
  });

  it("n’importe pas posthog-js", async () => {
    const posthog = vi.fn();
    vi.doMock("posthog-js", () => ({ default: { init: posthog, capture: posthog } }));
    // Re-import : le module analytics ne dépend plus de posthog-js.
    const mod = await import("@/lib/analytics");
    mod.captureProductEvent("filter_changed", { filter_name: "when" });
    expect(posthog).not.toHaveBeenCalled();
  });
});
