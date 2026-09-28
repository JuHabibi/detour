import { describe, expect, it, vi } from "vitest";
import type { LoadExplorerEventsResult } from "@/app/actions/load-explorer-events";
import type { EventItem } from "@/data/types";
import {
  runFriseEventsReload,
  type FriseEventsLoadSuccess,
} from "@/features/frise/useFriseEvents";

function event(id: string, category: EventItem["category"]): EventItem {
  return {
    id,
    title: id,
    category,
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    date: "2026-10-03",
    dateLabel: "Sam. 3 oct.",
    startAt: "2026-10-03T20:00:00+02:00",
    time: "20h00",
  };
}

function okPage(
  events: EventItem[],
  totalCount = events.length,
): LoadExplorerEventsResult {
  return { ok: true, events, totalCount, nextCursor: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runFriseEventsReload — concurrence", () => {
  it("garde le résultat de la dernière sélection si A finit après B", async () => {
    const gen = { current: 0 };
    const begin = () => {
      const id = ++gen.current;
      return () => id === gen.current;
    };

    let displayed: FriseEventsLoadSuccess | null = null;
    let error: string | null = null;
    let loading = false;

    const handlersFor = (isCurrent: () => boolean) => ({
      isCurrent,
      onLoading: (value: boolean) => {
        if (isCurrent()) loading = value;
      },
      onSuccess: (data: FriseEventsLoadSuccess) => {
        if (isCurrent()) {
          displayed = data;
          error = null;
        }
      },
      onError: (message: string) => {
        if (isCurrent()) {
          error = message;
          displayed = null;
        }
      },
    });

    const a = deferred<LoadExplorerEventsResult>();
    const b = deferred<LoadExplorerEventsResult>();

    const load = vi.fn(async (input: { category?: string | null }) => {
      if (input.category === "Musique") return a.promise;
      if (input.category === "Exposition") return b.promise;
      throw new Error(`catégorie inattendue: ${input.category}`);
    });

    const isA = begin();
    const loadA = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        load: load as typeof import("@/app/actions/load-explorer-events").loadExplorerEvents,
      },
      handlersFor(isA),
    );

    const isB = begin();
    const loadB = runFriseEventsReload(
      {
        category: "Exposition",
        city: null,
        search: "",
        load: load as typeof import("@/app/actions/load-explorer-events").loadExplorerEvents,
      },
      handlersFor(isB),
    );

    const eventsB = [event("b1", "Exposition")];
    b.resolve(okPage(eventsB, 1));
    await loadB;

    expect(displayed?.events.map((e) => e.id)).toEqual(["b1"]);
    expect(error).toBeNull();
    expect(loading).toBe(false);

    a.resolve(okPage([event("a1", "Musique")], 1));
    await loadA;

    expect(displayed?.events.map((e) => e.id)).toEqual(["b1"]);
    expect(error).toBeNull();
  });

  it("n’efface pas le résultat courant si une ancienne requête échoue", async () => {
    const gen = { current: 0 };
    const begin = () => {
      const id = ++gen.current;
      return () => id === gen.current;
    };

    let displayed: FriseEventsLoadSuccess | null = {
      events: [event("keep", "Exposition")],
      fetchedCount: 1,
      truncatedByCap: false,
      totalCount: 1,
    };
    let error: string | null = null;

    const handlersFor = (isCurrent: () => boolean) => ({
      isCurrent,
      onLoading: () => {},
      onSuccess: (data: FriseEventsLoadSuccess) => {
        if (isCurrent()) {
          displayed = data;
          error = null;
        }
      },
      onError: (message: string) => {
        if (isCurrent()) {
          error = message;
          displayed = {
            events: [],
            fetchedCount: 0,
            truncatedByCap: false,
            totalCount: 0,
          };
        }
      },
    });

    const stale = deferred<LoadExplorerEventsResult>();
    const current = deferred<LoadExplorerEventsResult>();

    const load = vi.fn(async (input: { category?: string | null }) => {
      if (input.category === "Musique") return stale.promise;
      return current.promise;
    });

    const isStale = begin();
    const staleLoad = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        load: load as typeof import("@/app/actions/load-explorer-events").loadExplorerEvents,
      },
      handlersFor(isStale),
    );

    const isCurrent = begin();
    const currentLoad = runFriseEventsReload(
      {
        category: "Exposition",
        city: null,
        search: "",
        load: load as typeof import("@/app/actions/load-explorer-events").loadExplorerEvents,
      },
      handlersFor(isCurrent),
    );

    current.resolve(okPage([event("fresh", "Exposition")], 1));
    await currentLoad;
    expect(displayed?.events.map((e) => e.id)).toEqual(["fresh"]);
    expect(error).toBeNull();

    stale.resolve({ ok: false, error: "Période invalide." });
    await staleLoad;

    expect(displayed?.events.map((e) => e.id)).toEqual(["fresh"]);
    expect(error).toBeNull();
  });

  it("ignore le commit après invalidation (hook désactivé / reload plus récent)", async () => {
    const gen = { current: 0 };
    const id = ++gen.current;
    const isCurrent = () => id === gen.current;

    let committed = false;
    let loading = true;
    const pending = deferred<LoadExplorerEventsResult>();

    const run = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        load: (async () => pending.promise) as typeof import("@/app/actions/load-explorer-events").loadExplorerEvents,
      },
      {
        isCurrent,
        onLoading: (value) => {
          if (isCurrent()) loading = value;
        },
        onSuccess: () => {
          committed = true;
        },
        onError: () => {
          committed = true;
        },
      },
    );

    gen.current += 1;
    pending.resolve(okPage([event("late", "Musique")]));
    await run;

    expect(committed).toBe(false);
    expect(loading).toBe(true);
  });
});
