import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logRadarDiagnostics } from "./radar-diagnostics";
import type { PublicHomeSnapshot } from "./get-public-home-data";
import type { DetourEvent } from "@/domain/events/event";

const now = new Date("2026-11-13T12:00:00Z");
function fixture() {
  const event: DetourEvent = {
    id: "public:1", title: "DO_NOT_LOG_TITLE", description: "DO_NOT_LOG_DESCRIPTION",
    imageUrl: null, startAt: "2026-11-13T19:00:00Z", endAt: null,
    venue: null, city: null, latitude: null, longitude: null,
    category: "Musique", genre: null, conditions: null, source: null,
    sourceUrl: "https://do-not-log.example", registrationUrl: null,
  };
  const item = { event, score: 3, planningScore: 3, reasons: [] };
  const snapshot: PublicHomeSnapshot = {
    events: [event], aiShortlist: [{ eventId: event.id, score: 3, planningScore: 3, reasons: [] }], exposeDebug: false,
  };
  const result: Parameters<typeof logRadarDiagnostics>[1] = {
    events: [event], aiShortlist: [item], highlights: [item], planningEvents: [],
    aiAssessments: [{ eventId: event.id, appeal: 3, missRisk: 3, planningNeed: 3, localRarity: 1, likelyDemand: 1, confidence: 0.8, reasons: ["DO_NOT_LOG_REASON"] }],
    aiMeta: {
      source: "partial", cacheHits: 1, cacheMisses: 0, displayMode: "auto",
      mode: "auto", enabled: true, cacheKey: null, assessedAt: null,
    },
  };
  return { snapshot, result };
}

describe("diagnostic Radar temporaire", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("DETOUR_RADAR_DIAGNOSTICS_UNTIL", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "deployment-sha");
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });
  it.each(["", "invalid", "2026-11-13T11:59:59Z", "2026-11-15T12:00:00Z"])("ne logue rien hors fenêtre autorisée : %s", (until) => {
    vi.stubEnv("DETOUR_RADAR_DIAGNOSTICS_UNTIL", until);
    const { snapshot, result } = fixture();
    logRadarDiagnostics(snapshot, result, now);
    expect(console.info).not.toHaveBeenCalled();
  });
  it("une ligne bornée, couverture explicite (partial ≠ incomplète), sans contenu ni donnée visiteur", () => {
    vi.stubEnv("DETOUR_RADAR_DIAGNOSTICS_UNTIL", "2026-11-13T13:00:00Z");
    const { snapshot, result } = fixture();
    logRadarDiagnostics(snapshot, result, now);
    expect(console.info).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.info).mock.calls[0][1] as string;
    expect(line).not.toMatch(/DO_NOT_LOG|do-not-log.example/);
    const record = JSON.parse(line);
    expect(record).toMatchObject({
      deployment: "deployment-sha", businessNow: now.toISOString(),
      assessedCount: 1, missingCount: 0, cacheSource: "partial", cacheHits: 1,
      finalIds: ["public:1"], changedSessionCount: 0,
    });
    const later = { ...result, events: [{ ...result.events[0], startAt: "2026-11-15T19:00:00Z" }] };
    logRadarDiagnostics(snapshot, later, now);
    const next = JSON.parse(vi.mocked(console.info).mock.calls[1][1] as string);
    expect(next.snapshotFingerprint).toBe(record.snapshotFingerprint);
    expect(next.assessmentFingerprint).toBe(record.assessmentFingerprint);
    expect(next.projectionFingerprint).not.toBe(record.projectionFingerprint);
    expect(next.changedSessionIds).toEqual(["public:1"]);
    logRadarDiagnostics(snapshot, { ...result, aiAssessments: [] }, now);
    const missing = JSON.parse(vi.mocked(console.info).mock.calls[2][1] as string);
    expect(missing.missingCount).toBe(1);
    expect(missing.assessmentFingerprint).not.toBe(record.assessmentFingerprint);
    vi.setSystemTime(new Date("2026-11-13T13:00:00Z"));
    logRadarDiagnostics(snapshot, result, now);
    expect(console.info).toHaveBeenCalledTimes(3);
  });
  it("plafonne les listes même sur un corpus volumineux", () => {
    vi.stubEnv("DETOUR_RADAR_DIAGNOSTICS_UNTIL", "2026-11-13T13:00:00Z");
    const { snapshot, result } = fixture();
    snapshot.events = Array.from({ length: 100 }, (_, i) => ({ ...snapshot.events[0], id: `public:${i}` }));
    result.events = snapshot.events.map((event) => ({ ...event, startAt: "2026-11-15T19:00:00Z" }));
    result.highlights = result.events.map((event) => ({ ...result.highlights[0], event }));
    logRadarDiagnostics(snapshot, result, now);
    const record = JSON.parse(vi.mocked(console.info).mock.calls[0][1] as string);
    expect(record.changedSessionCount).toBe(100);
    expect(record.changedSessionIds).toHaveLength(20);
    expect(record.finalIds).toHaveLength(10);
  });
});
