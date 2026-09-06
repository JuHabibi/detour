import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import type { OrleansRawEvent } from "@/infrastructure/sources/orleans/orleans-event.types";

const from = new Date("2026-09-01T00:00:00.000Z");
const to = new Date("2027-03-01T00:00:00.000Z");

function rawEvent(uid: string): OrleansRawEvent {
  return {
    uid,
    title_fr: `Event ${uid}`,
    description_fr: null,
    image: null,
    firstdate_begin: "2026-10-01T20:00:00+02:00",
    firstdate_end: null,
    location_name: "Salle",
    location_city: "Orléans",
    location_coordinates: null,
    categorie_principale: "Concert",
    conditions_fr: null,
    originagenda_title: "Agenda",
    canonicalurl: "https://example.com",
    registration: null,
    statut_evenement: "à venir",
  };
}

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  };
}

describe("OrleansEventAdapter pagination fail-closed", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("A. pagination complète (100 / 100 / 50) pour total_count=250", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`a-${i}`)),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`b-${i}`)),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 50 }, (_, i) => rawEvent(`c-${i}`)),
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const events = await new OrleansEventAdapter().fetchUpcomingEvents({
      from,
      to,
    });

    expect(events).toHaveLength(250);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("B. page courte prématurée → throw, aucun corpus partiel", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`a-${i}`)),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 30 }, (_, i) => rawEvent(`b-${i}`)),
        }),
      ) as unknown as typeof fetch;

    await expect(
      new OrleansEventAdapter().fetchUpcomingEvents({ from, to }),
    ).rejects.toThrow(/incomplete pagination/i);
  });

  it("C. page vide prématurée → throw", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`a-${i}`)),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: [],
        }),
      ) as unknown as typeof fetch;

    await expect(
      new OrleansEventAdapter().fetchUpcomingEvents({ from, to }),
    ).rejects.toThrow(/incomplete pagination/i);
  });

  it("D. total_count change entre deux pages → throw", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 250,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`a-${i}`)),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 180,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`b-${i}`)),
        }),
      ) as unknown as typeof fetch;

    await expect(
      new OrleansEventAdapter().fetchUpcomingEvents({ from, to }),
    ).rejects.toThrow(/total_count changed/i);
  });

  it("E. réponse invalide (total_count / results) → throw", async () => {
    const adapter = new OrleansEventAdapter();

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] })) as unknown as typeof fetch;
    await expect(adapter.fetchUpcomingEvents({ from, to })).rejects.toThrow(
      /invalid total_count/i,
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total_count: "250", results: [] }),
    ) as unknown as typeof fetch;
    await expect(adapter.fetchUpcomingEvents({ from, to })).rejects.toThrow(
      /invalid total_count/i,
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total_count: -1, results: [] }),
    ) as unknown as typeof fetch;
    await expect(adapter.fetchUpcomingEvents({ from, to })).rejects.toThrow(
      /invalid total_count/i,
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total_count: 1, results: null }),
    ) as unknown as typeof fetch;
    await expect(adapter.fetchUpcomingEvents({ from, to })).rejects.toThrow(
      /invalid results/i,
    );
  });

  it("F. corpus vide (total_count=0, results=[]) → []", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total_count: 0, results: [] }),
    ) as unknown as typeof fetch;

    const events = await new OrleansEventAdapter().fetchUpcomingEvents({
      from,
      to,
    });

    expect(events).toEqual([]);
  });

  it("G. HTTP non OK → throw", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total_count: 0, results: [] }, { ok: false, status: 429 }),
    ) as unknown as typeof fetch;

    await expect(
      new OrleansEventAdapter().fetchUpcomingEvents({ from, to }),
    ).rejects.toThrow(/Orleans API error: 429/);
  });
});
