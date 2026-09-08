import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrleansEventAdapter,
  buildOrleansWhereClause,
} from "@/infrastructure/sources/orleans/orleans-event.adapter";
import type { OrleansRawEvent } from "@/infrastructure/sources/orleans/orleans-event.types";

const from = new Date("2026-09-01T00:00:00.000Z");
const to = new Date("2027-03-01T00:00:00.000Z");

/** Mirrors ODS WHERE: begin <= to AND ifnull(end, begin) >= from. */
function overlapsOrleansWindow(
  begin: string,
  end: string | null,
  windowFrom: Date,
  windowTo: Date,
): boolean {
  const start = new Date(begin);
  const effectiveEnd = end ? new Date(end) : start;
  return start <= windowTo && effectiveEnd >= windowFrom;
}

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

describe("OrleansEventAdapter window intersection WHERE", () => {
  const originalFetch = globalThis.fetch;
  const syncFrom = new Date("2026-09-08T00:00:00.000Z");
  const syncTo = new Date("2026-09-15T00:00:00.000Z");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("envoie un WHERE d'intersection ODS avec ifnull(end, begin)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total_count: 0, results: [] }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await new OrleansEventAdapter().fetchUpcomingEvents({
      from: syncFrom,
      to: syncTo,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(calledUrl.searchParams.get("where")).toBe(
      buildOrleansWhereClause("2026-09-08T00:00:00", "2026-09-15T00:00:00"),
    );
    expect(calledUrl.searchParams.get("where")).toBe(
      "firstdate_begin <= date'2026-09-15T00:00:00' AND ifnull(firstdate_end, firstdate_begin) >= date'2026-09-08T00:00:00' AND statut_evenement = 'à venir'",
    );
  });

  it("1. begin < from < end → inclus", () => {
    expect(
      overlapsOrleansWindow(
        "2026-09-07T00:00:00+02:00",
        "2026-09-10T00:00:00+02:00",
        syncFrom,
        syncTo,
      ),
    ).toBe(true);
  });

  it("2. begin > to → exclu", () => {
    expect(
      overlapsOrleansWindow(
        "2026-09-16T00:00:00+02:00",
        "2026-09-17T00:00:00+02:00",
        syncFrom,
        syncTo,
      ),
    ).toBe(false);
  });

  it("3. end < from → exclu", () => {
    expect(
      overlapsOrleansWindow(
        "2026-09-01T00:00:00+02:00",
        "2026-09-07T00:00:00+02:00",
        syncFrom,
        syncTo,
      ),
    ).toBe(false);
  });

  it("4. end null et begin dans la fenêtre → inclus", () => {
    expect(
      overlapsOrleansWindow(
        "2026-09-10T20:00:00+02:00",
        null,
        syncFrom,
        syncTo,
      ),
    ).toBe(true);
  });

  it("5. end null et begin avant from → exclu", () => {
    expect(
      overlapsOrleansWindow(
        "2026-09-07T20:00:00+02:00",
        null,
        syncFrom,
        syncTo,
      ),
    ).toBe(false);
  });

  it("6. pagination existante toujours OK avec le nouveau WHERE", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 150,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`p-${i}`)),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_count: 150,
          results: Array.from({ length: 50 }, (_, i) => rawEvent(`q-${i}`)),
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const events = await new OrleansEventAdapter().fetchUpcomingEvents({
      from: syncFrom,
      to: syncTo,
    });

    expect(events).toHaveLength(150);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const where = new URL(String(call[0])).searchParams.get("where");
      expect(where).toContain("ifnull(firstdate_end, firstdate_begin)");
      expect(where).not.toContain("firstdate_begin >=");
    }
  });
});
