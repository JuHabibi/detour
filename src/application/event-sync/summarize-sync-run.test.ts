import { describe, expect, it } from "vitest";
import type { SyncResult } from "@/application/event-sync/sync-types";
import {
  SYNC_FRESHNESS_STALE_AFTER_MS,
  buildSyncFreshnessReport,
  classifySourceFreshness,
  summarizeSyncRun,
} from "@/application/event-sync/summarize-sync-run";

const success = (adapterId: string): SyncResult => ({
  adapterId,
  status: "success",
  fetchedCount: 1,
  deactivatedCount: 0,
  previousActiveCount: 1,
});

const error = (adapterId: string): SyncResult => ({
  adapterId,
  status: "error",
  errorCode: "fetch_failed",
});

const busy = (adapterId: string): SyncResult => ({
  adapterId,
  status: "skipped",
  reason: "busy",
});

describe("summarizeSyncRun", () => {
  it("toutes les sources réussissent → ok / 200", () => {
    expect(summarizeSyncRun([success("orleans"), success("saran")])).toEqual({
      status: "ok",
      ok: true,
      httpStatus: 200,
      successCount: 2,
      errorCount: 0,
      skippedCount: 0,
    });
  });

  it("succès + busy → ok / 200 (busy n’est pas une panne)", () => {
    expect(summarizeSyncRun([success("orleans"), busy("saran")])).toEqual({
      status: "ok",
      ok: true,
      httpStatus: 200,
      successCount: 1,
      errorCount: 0,
      skippedCount: 1,
    });
  });

  it("une source échoue → partial / 503", () => {
    expect(summarizeSyncRun([success("orleans"), error("saran")])).toEqual({
      status: "partial",
      ok: false,
      httpStatus: 503,
      successCount: 1,
      errorCount: 1,
      skippedCount: 0,
    });
  });

  it("toutes les sources échouent → error / 503", () => {
    expect(summarizeSyncRun([error("orleans"), error("saran")])).toEqual({
      status: "error",
      ok: false,
      httpStatus: 503,
      successCount: 0,
      errorCount: 2,
      skippedCount: 0,
    });
  });

  it("toutes busy → skipped / 200", () => {
    expect(summarizeSyncRun([busy("orleans"), busy("saran")])).toEqual({
      status: "skipped",
      ok: true,
      httpStatus: 200,
      successCount: 0,
      errorCount: 0,
      skippedCount: 2,
    });
  });

  it("erreur + busy sans succès → error / 503", () => {
    expect(summarizeSyncRun([error("saran"), busy("orleans")])).toEqual({
      status: "error",
      ok: false,
      httpStatus: 503,
      successCount: 0,
      errorCount: 1,
      skippedCount: 1,
    });
  });
});

describe("classifySourceFreshness / buildSyncFreshnessReport", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");

  it("succès récent → fresh", () => {
    expect(
      classifySourceFreshness(new Date("2026-11-01T05:00:00.000Z"), now),
    ).toBe("fresh");
  });

  it("dernier succès trop ancien → stale", () => {
    const old = new Date(
      now.getTime() - SYNC_FRESHNESS_STALE_AFTER_MS - 1,
    );
    expect(classifySourceFreshness(old, now)).toBe("stale");
  });

  it("jamais de succès → never_succeeded", () => {
    expect(classifySourceFreshness(null, now)).toBe("never_succeeded");
  });

  it("rapport : une entrée par adapter, y compris absent de la map", () => {
    const lastSuccessByAdapter = new Map<string, Date | null>([
      ["orleans", new Date("2026-11-01T05:00:00.000Z")],
      ["saran", new Date("2026-10-30T05:00:00.000Z")],
    ]);

    expect(
      buildSyncFreshnessReport({
        adapterIds: ["orleans", "saran", "bouillon"],
        lastSuccessByAdapter,
        now,
      }),
    ).toEqual([
      {
        adapterId: "orleans",
        lastSuccessAt: "2026-11-01T05:00:00.000Z",
        freshness: "fresh",
      },
      {
        adapterId: "saran",
        lastSuccessAt: "2026-10-30T05:00:00.000Z",
        freshness: "stale",
      },
      {
        adapterId: "bouillon",
        lastSuccessAt: null,
        freshness: "never_succeeded",
      },
    ]);
  });
});
