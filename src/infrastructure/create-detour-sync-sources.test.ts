import { describe, expect, it } from "vitest";
import { createDetourSyncSources } from "@/infrastructure/create-detour-sync-sources";
import { CompositeEventSourceAdapter } from "@/infrastructure/composite-event-source.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

describe("createDetourSyncSources", () => {
  it("retourne orleans puis saran avec adapters sources directs", () => {
    const sources = createDetourSyncSources();

    expect(sources.map((s) => s.adapterId)).toEqual(["orleans", "saran"]);
    expect(sources[0]?.adapter).toBeInstanceOf(OrleansEventAdapter);
    expect(sources[1]?.adapter).toBeInstanceOf(SaranEventAdapter);

    for (const source of sources) {
      expect(source.adapter).not.toBeInstanceOf(CompositeEventSourceAdapter);
    }
  });
});
