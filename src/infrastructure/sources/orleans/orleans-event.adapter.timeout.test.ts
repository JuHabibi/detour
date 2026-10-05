import { describe, expect, it, vi } from "vitest";
import {
  SOURCE_HTTP_TIMEOUT_MS,
  withHttpTimeout,
} from "@/infrastructure/http/http-timeout";
import {
  hangingFetch,
  headersThenHangingBody,
} from "@/infrastructure/http/http-timeout.test-helpers";
import {
  OrleansEventAdapter,
  buildOrleansWhereClause,
} from "@/infrastructure/sources/orleans/orleans-event.adapter";
import type { OrleansRawEvent } from "@/infrastructure/sources/orleans/orleans-event.types";

const from = new Date("2026-09-01T00:00:00.000Z");
const to = new Date("2027-03-01T00:00:00.000Z");
const SHORT_TIMEOUT_MS = 40;

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

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  };
}

describe("OrleansEventAdapter HTTP timeout", () => {
  it("annule une requête bloquée (pas de corpus)", async () => {
    const fetchImpl = vi.fn(hangingFetch);
    const adapter = new OrleansEventAdapter({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(
      adapter.fetchUpcomingEvents({ from, to }),
    ).rejects.toMatchObject({ name: "TimeoutError" });

    expect(fetchImpl).toHaveBeenCalled();
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("soumet un corps bloqué après headers au même délai", async () => {
    const fetchImpl = vi.fn(headersThenHangingBody);
    const adapter = new OrleansEventAdapter({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(
      adapter.fetchUpcomingEvents({ from, to }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("expiration page 2 → throw, aucun corpus partiel", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () =>
        jsonResponse({
          total_count: 150,
          results: Array.from({ length: 100 }, (_, i) => rawEvent(`p1-${i}`)),
        }),
      )
      .mockImplementationOnce(hangingFetch);

    const adapter = new OrleansEventAdapter({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(
      adapter.fetchUpcomingEvents({ from, to }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("timeout pendant JSON ≠ « invalid JSON »", async () => {
    const fetchImpl = vi.fn(headersThenHangingBody);
    const adapter = new OrleansEventAdapter({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    try {
      await adapter.fetchUpcomingEvents({ from, to });
      expect.fail("expected timeout");
    } catch (error) {
      expect(error).toMatchObject({ name: "TimeoutError" });
      expect(String(error)).not.toMatch(/invalid JSON/i);
    }
  });

  it("withHttpTimeout utilise le délai source par défaut", () => {
    expect(SOURCE_HTTP_TIMEOUT_MS).toBe(15_000);
    const init = withHttpTimeout(SOURCE_HTTP_TIMEOUT_MS);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(buildOrleansWhereClause("a", "b")).toContain("ifnull");
  });
});
