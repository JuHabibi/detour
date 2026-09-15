import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { EventService } from "@/application/event.service";
import {
  measurePublicHomeSnapshotBytes,
  reviveUpcomingPipelineFromSlim,
  toPublicHomeSnapshotSlim,
} from "@/application/home/get-public-home-data";
import type { AiConfig } from "@/config/ai-config";
import type { DetourEvent } from "@/domain/events/event";
import { isRadarEligibleAvailability } from "@/domain/events/event-availability";
import { rankDetourHighlightCandidates } from "@/domain/editorial/select-detour-highlights";
import type { EventSource } from "@/application/ports/event-source";
import type { HighlightAssessmentProvider } from "@/application/ports/highlight-assessment";
import { createMemoryAiAssessmentCacheStore } from "@/application/ai/ai-assessment-cache";

function event(id: string, overrides?: Partial<DetourEvent>): DetourEvent {
  return {
    id,
    title: `Spectacle avec Alice Moreau ${id}`,
    description: `Soirée avec Alice Moreau ${id}.`.padEnd(90, "."),
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: "MJC",
    city: "Olivet",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: "https://example.com",
    registrationUrl: "https://example.com/book",
    relevance: "culture",
    ...overrides,
  };
}

const autoConfig: AiConfig = {
  enabled: true,
  mode: "auto",
  displayMode: "auto",
};

function mockAssessor(): HighlightAssessmentProvider {
  return {
    cacheContext: {
      model: "gpt-4o-mini",
      promptVersion: "detour-ai-assess-v3.1",
      generation: { temperature: 0.2 },
    },
    assess: vi.fn().mockImplementation(async (input: DetourEvent[]) =>
      input.map((item) => ({
        eventId: item.id,
        appeal: 4,
        missRisk: 3,
        localRarity: 1,
        planningNeed: 3,
        likelyDemand: 2,
        confidence: 0.85,
        reasons: ["test"],
      })),
    ),
  };
}

describe("getPublicHomeData — invariants public", () => {
  it("signature sans paramètre user / session / favoris", async () => {
    const mod = await import("@/application/home/get-public-home-data");
    expect(typeof mod.getPublicHomeData).toBe("function");
    expect(typeof mod.getPublicHomeSnapshot).toBe("function");
    expect(typeof mod.materializePublicHomeData).toBe("function");
    expect(mod.getPublicHomeData.length).toBe(1);
    expect(mod.getPublicHomeSnapshot.length).toBe(1);
  });

  it("source : pas d’auth ni de favoris dans le compute public", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/application/home/get-public-home-data.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/getAccountAuthState/);
    expect(source).not.toMatch(/listFavoriteEventIdsForUser/);
    expect(source).not.toMatch(/favorite/);
    expect(source).toContain("buildUpcomingPipeline");
    expect(source).toContain("finalizeUpcomingWithAutoAi");
    expect(source).toContain("listExplorerEvents");
    expect(source).toContain("toPublicHomeSnapshotSlim");
  });
});

describe("PublicHomeSnapshot slim", () => {
  it("ne contient aucune structure pipeline lourde", () => {
    const events = [event("a"), event("b"), event("c")];
    const ranked = rankDetourHighlightCandidates(
      events.filter((item) => isRadarEligibleAvailability(item.availabilityStatus)),
    );
    const snapshot = toPublicHomeSnapshotSlim({
      events,
      aiShortlist: ranked.slice(0, 2),
      explorerPage: { events: [events[0]!], totalCount: 1, nextCursor: null },
      exposeDebug: false,
    });

    const keys = Object.keys(snapshot).sort();
    expect(keys).toEqual([
      "aiShortlist",
      "events",
      "explorerPage",
      "exposeDebug",
    ]);
    expect(snapshot).not.toHaveProperty("ingestion");
    expect(snapshot).not.toHaveProperty("rawEvents");
    expect(snapshot).not.toHaveProperty("classifiedEvents");
    expect(snapshot).not.toHaveProperty("rankedCandidates");
    expect(snapshot).not.toHaveProperty("highlightCandidates");
    expect(snapshot).not.toHaveProperty("duplicates");
    expect(snapshot).not.toHaveProperty("aiShortlistInclusion");
    expect(snapshot).not.toHaveProperty("aiShortlistBucketSizes");
    expect(snapshot.aiShortlist[0]).not.toHaveProperty("event");
    expect(snapshot.aiShortlist[0]).toMatchObject({
      eventId: expect.any(String),
      score: expect.any(Number),
      planningScore: expect.any(Number),
      reasons: expect.any(Array),
    });
  });

  it("reconstruit la shortlist depuis les ids dans l’ordre", () => {
    const events = [event("a"), event("b"), event("c")];
    const ranked = rankDetourHighlightCandidates(events);
    const shortlist = [ranked[2]!, ranked[0]!];
    const snapshot = toPublicHomeSnapshotSlim({
      events,
      aiShortlist: shortlist,
      explorerPage: { events: [], totalCount: 0, nextCursor: null },
      exposeDebug: false,
    });

    const revived = reviveUpcomingPipelineFromSlim(snapshot);
    expect(revived.aiShortlist.map((item) => item.event.id)).toEqual([
      shortlist[0]!.event.id,
      shortlist[1]!.event.id,
    ]);
    expect(revived.aiShortlist[0]?.score).toBe(shortlist[0]!.score);
    expect(revived.aiShortlist[0]?.planningScore).toBe(
      shortlist[0]!.planningScore,
    );
    expect(revived.aiShortlist[0]?.reasons).toEqual(shortlist[0]!.reasons);
  });

  it("materialize / finalize : même sélection éditoriale que pipeline complet", async () => {
    const events = [
      event("star", {
        title: "Concert Alice Moreau headliner",
        description: "Grande soirée avec Alice Moreau connue.".padEnd(100, "."),
        startAt: "2026-10-01T20:00:00+02:00",
      }),
      event("gem", {
        title: "Atelier local rare",
        city: "St Jean de Braye",
        startAt: "2026-10-05T18:00:00+02:00",
      }),
      event("plan", {
        title: "Festival à anticiper",
        startAt: "2026-12-20T20:00:00+02:00",
      }),
      event("other", {
        title: "Spectacle de quartier",
        startAt: "2026-10-08T20:00:00+02:00",
      }),
    ];

    const source: EventSource = {
      fetchUpcomingEvents: async () => events,
    };
    const service = new EventService(source, mockAssessor(), {
      aiConfig: autoConfig,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    });

    const pipeline = await service.buildUpcomingPipeline({
      from: new Date("2026-09-15T10:00:00.000Z"),
      to: new Date("2027-03-15T10:00:00.000Z"),
    });

    const snapshot = toPublicHomeSnapshotSlim({
      events: pipeline.events,
      aiShortlist: pipeline.aiShortlist,
      explorerPage: { events: [], totalCount: 0, nextCursor: null },
      exposeDebug: false,
    });
    const revived = reviveUpcomingPipelineFromSlim(snapshot);

    const fromFull = await service.finalizeUpcomingWithAutoAi(pipeline);
    const fromSlim = await service.finalizeUpcomingWithAutoAi(revived);

    expect(fromSlim.highlights.map((item) => item.event.id)).toEqual(
      fromFull.highlights.map((item) => item.event.id),
    );
    expect(fromSlim.planningEvents.map((item) => item.event.id)).toEqual(
      fromFull.planningEvents.map((item) => item.event.id),
    );
    expect(fromSlim.aiShortlist.map((item) => item.event.id)).toEqual(
      fromFull.aiShortlist.map((item) => item.event.id),
    );
  });

  it("taille slim ≪ pipeline redondant ; cible < 1.5 Mo pour ~801 events", () => {
    const events = Array.from({ length: 801 }, (_, index) =>
      event(`e${index}`, {
        description: `Description longue événement ${index}. `.repeat(40),
        title: `Événement culturel n°${index} avec artiste`,
      }),
    );
    const ranked = rankDetourHighlightCandidates(events);
    const aiShortlist = ranked.slice(0, 60);

    const slim = toPublicHomeSnapshotSlim({
      events,
      aiShortlist,
      explorerPage: {
        events: events.slice(0, 12),
        totalCount: 801,
        nextCursor: null,
      },
      exposeDebug: false,
    });

    const fat = {
      ingestion: { events },
      rawEvents: events,
      classifiedEvents: events,
      events,
      rankedCandidates: ranked,
      highlightCandidates: ranked.slice(0, 20),
      aiShortlist,
      duplicates: [],
      explorerPage: slim.explorerPage,
      exposeDebug: false,
    };

    const slimBytes = measurePublicHomeSnapshotBytes(slim);
    const fatBytes = Buffer.byteLength(JSON.stringify(fat), "utf8");

    expect(slimBytes).toBeLessThan(1.5 * 1024 * 1024);
    expect(slimBytes).toBeLessThan(fatBytes / 3);
    expect(slimBytes).toBeLessThan(2 * 1024 * 1024);
  });
});

describe("next-public-home-cache — frontière nest IA", () => {
  it("snapshot dans unstable_cache ; materialize (IA) hors callback", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/infrastructure/next-public-home-cache.ts"),
      "utf8",
    );
    expect(source).toContain("getPublicHomeSnapshot");
    expect(source).toContain("materializePublicHomeData");
    expect(source).toContain("pre-ai-snapshot-slim-v1");
    expect(source).not.toMatch(/return getPublicHomeData\(/);
    const callbackStart = source.indexOf("async () => {");
    const callbackBody = source.slice(
      callbackStart,
      source.indexOf("},", callbackStart),
    );
    expect(callbackBody).toContain("getPublicHomeSnapshot");
    expect(callbackBody).not.toContain("materializePublicHomeData");
    expect(callbackBody).not.toContain("finalizeUpcomingWithAutoAi");
  });
});

describe("loadHomePage — frontière public / user", () => {
  it("orchestre cache public + auth + favoris hors cache", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/_server/load-home-page.ts"),
      "utf8",
    );
    expect(source).toContain("getCachedPublicHomeData");
    expect(source).toContain("getAccountAuthState");
    expect(source).toContain("listFavoriteEventIdsForUser");
    expect(source).not.toContain("getUpcomingEvents");
    expect(source).not.toContain("listExplorerEvents");
  });
});
