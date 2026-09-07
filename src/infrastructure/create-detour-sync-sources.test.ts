import { describe, expect, it } from "vitest";
import { createDetourSyncSources } from "@/infrastructure/create-detour-sync-sources";
import { CompositeEventSourceAdapter } from "@/infrastructure/composite-event-source.adapter";
import { IngreAgendaEventAdapter } from "@/infrastructure/sources/ingre-agenda/ingre-agenda.adapter";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

describe("createDetourSyncSources", () => {
  it("retourne orleans, saran, ingre-agenda avec adapters sources directs", () => {
    const sources = createDetourSyncSources();

    expect(sources.map((s) => s.adapterId)).toEqual([
      "orleans",
      "saran",
      "ingre-agenda",
    ]);
    expect(sources[0]?.adapter).toBeInstanceOf(OrleansEventAdapter);
    expect(sources[1]?.adapter).toBeInstanceOf(SaranEventAdapter);
    expect(sources[2]?.adapter).toBeInstanceOf(IngreAgendaEventAdapter);

    for (const source of sources) {
      expect(source.adapter).not.toBeInstanceOf(CompositeEventSourceAdapter);
    }
  });
});
