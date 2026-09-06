import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { PoolClient } from "pg";

const ensureSourceRow = vi.fn();
const tryAcquireLease = vi.fn();
const lockAndVerifyLease = vi.fn();
const markSuccess = vi.fn();
const markError = vi.fn();
const countActiveByAdapter = vi.fn();
const upsertMany = vi.fn();
const deactivateNotSeenSince = vi.fn();

const clientQuery = vi.fn();
const clientRelease = vi.fn();
const connect = vi.fn();

vi.mock("@/infrastructure/db/source-sync.repository", () => ({
  ensureSourceRow: (...args: unknown[]) => ensureSourceRow(...args),
  tryAcquireLease: (...args: unknown[]) => tryAcquireLease(...args),
  lockAndVerifyLease: (...args: unknown[]) => lockAndVerifyLease(...args),
  markSuccess: (...args: unknown[]) => markSuccess(...args),
  markError: (...args: unknown[]) => markError(...args),
  releaseLease: vi.fn(),
  getSyncState: vi.fn(),
}));

vi.mock("@/infrastructure/db/event.repository", () => ({
  countActiveByAdapter: (...args: unknown[]) => countActiveByAdapter(...args),
  upsertMany: (...args: unknown[]) => upsertMany(...args),
  deactivateNotSeenSince: (...args: unknown[]) =>
    deactivateNotSeenSince(...args),
}));

vi.mock("@/infrastructure/db/postgres", () => ({
  getPool: () => ({ connect }),
}));

import { syncEventSource } from "@/application/event-sync/sync-event-source";
import { SYNC_LEASE_TTL_MS } from "@/application/event-sync/sync-types";

function eventStub(id: string): DetourEvent {
  return {
    id,
    title: "T",
    description: null,
    imageUrl: null,
    startAt: "2026-09-10T18:00:00.000Z",
    endAt: null,
    venue: null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "culture",
    genre: null,
    conditions: null,
    source: "test",
    sourceUrl: null,
    registrationUrl: null,
  };
}

function mockAdapter(
  impl: EventSourceAdapter["fetchUpcomingEvents"],
): EventSourceAdapter {
  return { fetchUpcomingEvents: vi.fn(impl) };
}

describe("syncEventSource", () => {
  const fixedNow = new Date("2026-09-06T12:00:00.000Z");
  const now = () => fixedNow;
  const from = fixedNow;
  const to = new Date("2026-10-01T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    clientQuery.mockResolvedValue({});
    clientRelease.mockReset();
    connect.mockResolvedValue({
      query: clientQuery,
      release: clientRelease,
    } satisfies Partial<PoolClient>);
    ensureSourceRow.mockResolvedValue(undefined);
    tryAcquireLease.mockResolvedValue(true);
    lockAndVerifyLease.mockResolvedValue(true);
    markSuccess.mockResolvedValue(true);
    markError.mockResolvedValue(true);
    countActiveByAdapter.mockResolvedValue(0);
    upsertMany.mockResolvedValue(undefined);
    deactivateNotSeenSince.mockResolvedValue(0);
  });

  it("SUCCESS : ordre ensure → acquire → fetch → count → tx → commit", async () => {
    const events = [eventStub("e1"), eventStub("e2")];
    const adapter = mockAdapter(async () => events);
    deactivateNotSeenSince.mockResolvedValue(3);

    const callOrder: string[] = [];
    ensureSourceRow.mockImplementation(async () => {
      callOrder.push("ensure");
    });
    tryAcquireLease.mockImplementation(async () => {
      callOrder.push("acquire");
      return true;
    });
    (adapter.fetchUpcomingEvents as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        callOrder.push("fetch");
        return events;
      },
    );
    countActiveByAdapter.mockImplementation(async () => {
      callOrder.push("count");
      return 1;
    });
    clientQuery.mockImplementation(async (sql: string) => {
      callOrder.push(String(sql).trim().split(/\s+/)[0]!);
      return {};
    });
    lockAndVerifyLease.mockImplementation(async () => {
      callOrder.push("verify");
      return true;
    });
    upsertMany.mockImplementation(async () => {
      callOrder.push("upsert");
    });
    deactivateNotSeenSince.mockImplementation(async () => {
      callOrder.push("deactivate");
      return 3;
    });
    markSuccess.mockImplementation(async (params: { at: Date }) => {
      callOrder.push("markSuccess");
      expect(params.at).toEqual(fixedNow);
      return true;
    });

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "success",
      fetchedCount: 2,
      deactivatedCount: 3,
    });
    expect(callOrder).toEqual([
      "ensure",
      "acquire",
      "fetch",
      "count",
      "BEGIN",
      "verify",
      "upsert",
      "deactivate",
      "markSuccess",
      "COMMIT",
    ]);
    expect(tryAcquireLease).toHaveBeenCalledWith(
      "orleans",
      expect.any(String),
      new Date(fixedNow.getTime() + SYNC_LEASE_TTL_MS),
    );
    expect(markError).not.toHaveBeenCalled();
    expect(clientRelease).toHaveBeenCalled();
  });

  it("BUSY : pas de fetch, pas de tx, pas de markError", async () => {
    tryAcquireLease.mockResolvedValue(false);
    const adapter = mockAdapter(async () => [eventStub("e1")]);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "skipped",
      reason: "busy",
    });
    expect(adapter.fetchUpcomingEvents).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(markError).not.toHaveBeenCalled();
    expect(upsertMany).not.toHaveBeenCalled();
  });

  it("FETCH ERROR : markError fetch_failed, pas d’écriture events", async () => {
    const adapter = mockAdapter(async () => {
      throw new Error("network");
    });

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "fetch_failed",
    });
    expect(markError).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: "orleans",
        errorCode: "fetch_failed",
        releaseLease: true,
      }),
    );
    expect(upsertMany).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("EMPTY GUARD : corpus actif + fetch vide → empty_corpus", async () => {
    countActiveByAdapter.mockResolvedValue(5);
    const adapter = mockAdapter(async () => []);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "empty_corpus",
    });
    expect(markError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "empty_corpus" }),
    );
    expect(connect).not.toHaveBeenCalled();
    expect(upsertMany).not.toHaveBeenCalled();
  });

  it("FIRST EMPTY : count=0 + fetch [] → succès autorisé", async () => {
    countActiveByAdapter.mockResolvedValue(0);
    const adapter = mockAdapter(async () => []);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toMatchObject({
      adapterId: "orleans",
      status: "success",
      fetchedCount: 0,
    });
    expect(upsertMany).toHaveBeenCalled();
    expect(markSuccess).toHaveBeenCalled();
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("LOST LEASE : verify false → ROLLBACK, pas d’écriture events", async () => {
    lockAndVerifyLease.mockResolvedValue(false);
    const adapter = mockAdapter(async () => [eventStub("e1")]);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "skipped",
      reason: "lost_lease",
    });
    expect(upsertMany).not.toHaveBeenCalled();
    expect(markSuccess).not.toHaveBeenCalled();
    expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(clientQuery).not.toHaveBeenCalledWith("COMMIT");
  });

  it("UPSERT ERROR : ROLLBACK + transaction_failed", async () => {
    upsertMany.mockRejectedValue(new Error("upsert boom"));
    const adapter = mockAdapter(async () => [eventStub("e1")]);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "transaction_failed",
    });
    expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(clientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(markError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "transaction_failed" }),
    );
  });

  it("MARK SUCCESS FALSE : ROLLBACK obligatoire, pas de COMMIT", async () => {
    markSuccess.mockResolvedValue(false);
    const adapter = mockAdapter(async () => [eventStub("e1")]);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "transaction_failed",
    });
    expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(clientQuery).not.toHaveBeenCalledWith("COMMIT");
  });

  it("database_failed si ensureSourceRow throw", async () => {
    ensureSourceRow.mockRejectedValue(new Error("db down"));
    const adapter = mockAdapter(async () => []);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "database_failed",
    });
    expect(adapter.fetchUpcomingEvents).not.toHaveBeenCalled();
    expect(markError).not.toHaveBeenCalled();
  });

  it("database_failed si tryAcquireLease throw", async () => {
    tryAcquireLease.mockRejectedValue(new Error("db down"));
    const adapter = mockAdapter(async () => []);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "database_failed",
    });
    expect(adapter.fetchUpcomingEvents).not.toHaveBeenCalled();
    expect(markError).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: "orleans",
        errorCode: "database_failed",
        releaseLease: true,
      }),
    );
  });

  it("database_failed si countActiveByAdapter throw après lease", async () => {
    countActiveByAdapter.mockRejectedValue(new Error("db down"));
    const adapter = mockAdapter(async () => [eventStub("e1")]);

    const result = await syncEventSource({
      adapterId: "orleans",
      adapter,
      from,
      to,
      now,
    });

    expect(result).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "database_failed",
    });
    expect(markError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "database_failed" }),
    );
    expect(upsertMany).not.toHaveBeenCalled();
  });
});
