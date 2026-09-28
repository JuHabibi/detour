import { describe, expect, it, vi } from "vitest";
import type {
  LoadExplorerEventsInput,
  LoadExplorerEventsResult,
} from "@/app/actions/load-explorer-events";
import type { EventItem } from "@/data/types";
import {
  runFriseEventsReload,
  type FriseEventsLoadSuccess,
} from "@/features/frise/useFriseEvents";

type LoadFn = (
  input: LoadExplorerEventsInput,
) => Promise<LoadExplorerEventsResult>;

function event(
  id: string,
  category: EventItem["category"],
  startAt: string,
): EventItem {
  const date = startAt.slice(0, 10);
  return {
    id,
    title: id,
    category,
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    date,
    dateLabel: date,
    startAt,
    time: "20h00",
  };
}

function okPage(
  events: EventItem[],
  totalCount = events.length,
  nextCursor: string | null = null,
): LoadExplorerEventsResult {
  return { ok: true, events, totalCount, nextCursor };
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

/** Handlers naïfs : enregistrent tout appel. Le garde-fou est dans runFriseEventsReload. */
function recordHandlers(isCurrent: () => boolean) {
  const calls = {
    loading: [] as boolean[],
    success: [] as FriseEventsLoadSuccess[],
    error: [] as string[],
  };
  return {
    calls,
    handlers: {
      isCurrent,
      onLoading: (value: boolean) => {
        calls.loading.push(value);
      },
      onSuccess: (data: FriseEventsLoadSuccess) => {
        calls.success.push(data);
      },
      onError: (message: string) => {
        calls.error.push(message);
      },
    },
  };
}

describe("runFriseEventsReload — fenêtre visible", () => {
  it("affiche les sorties de la fenêtre suivante même si >150 précèdent dans upcoming", async () => {
    const gen = { current: 0 };
    const isCurrent = () => gen.current === 1;
    gen.current = 1;

    const earlyFlood = Array.from({ length: 150 }, (_, i) =>
      event(`early-${i}`, "Musique", "2026-09-05T20:00:00+02:00"),
    );
    const nextWindowEvent = event(
      "dec-concert",
      "Musique",
      "2026-12-10T20:00:00+01:00",
    );

    const load = vi.fn<LoadFn>(async (input) => {
      // Sans from/to, on simulerait le bug (150 premiers upcoming).
      if (!input.from || !input.to) {
        return okPage(earlyFlood, 400);
      }
      if (input.from === "2026-12-01" && input.to === "2027-02-28") {
        return okPage([nextWindowEvent], 1);
      }
      if (input.from === "2026-09-01" && input.to === "2026-11-30") {
        return okPage(earlyFlood, 150);
      }
      throw new Error(`fenêtre inattendue: ${input.from}→${input.to}`);
    });

    const recorded = recordHandlers(isCurrent);
    await runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-12-01",
        to: "2027-02-28",
        load,
      },
      recorded.handlers,
    );

    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        when: "upcoming",
        from: "2026-12-01",
        to: "2027-02-28",
        category: "Musique",
      }),
    );
    expect(recorded.calls.success).toHaveLength(1);
    expect(recorded.calls.success[0]?.events.map((e) => e.id)).toEqual([
      "dec-concert",
    ]);
    expect(recorded.calls.success[0]?.truncatedByCap).toBe(false);
  });

  it("ignore la réponse de l’ancienne fenêtre si on navigue pendant le chargement", async () => {
    const gen = { current: 0 };
    const begin = () => {
      const id = ++gen.current;
      return () => id === gen.current;
    };

    const first = deferred<LoadExplorerEventsResult>();
    const second = deferred<LoadExplorerEventsResult>();

    const load = vi.fn<LoadFn>(async (input) => {
      if (input.from === "2026-09-01") return first.promise;
      if (input.from === "2026-12-01") return second.promise;
      throw new Error(`from inattendu: ${input.from}`);
    });

    const recordedA = recordHandlers(begin());
    const loadA = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recordedA.handlers,
    );

    const recordedB = recordHandlers(begin());
    const loadB = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-12-01",
        to: "2027-02-28",
        load,
      },
      recordedB.handlers,
    );

    second.resolve(
      okPage([
        event("winter", "Musique", "2026-12-15T20:00:00+01:00"),
      ]),
    );
    await loadB;

    expect(recordedB.calls.success[0]?.events.map((e) => e.id)).toEqual([
      "winter",
    ]);

    first.resolve(
      okPage([
        event("autumn", "Musique", "2026-09-20T20:00:00+02:00"),
      ]),
    );
    await loadA;

    expect(recordedA.calls.success).toEqual([]);
    expect(recordedA.calls.error).toEqual([]);
    expect(recordedB.calls.success).toHaveLength(1);
  });
});

describe("runFriseEventsReload — concurrence", () => {
  it("garde le résultat de la dernière sélection si A finit après B", async () => {
    const gen = { current: 0 };
    const begin = () => {
      const id = ++gen.current;
      return () => id === gen.current;
    };

    const a = deferred<LoadExplorerEventsResult>();
    const b = deferred<LoadExplorerEventsResult>();

    const load = vi.fn<LoadFn>(async (input) => {
      if (input.category === "Musique") return a.promise;
      if (input.category === "Exposition") return b.promise;
      throw new Error(`catégorie inattendue: ${input.category}`);
    });

    const recordedA = recordHandlers(begin());
    const loadA = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recordedA.handlers,
    );

    const recordedB = recordHandlers(begin());
    const loadB = runFriseEventsReload(
      {
        category: "Exposition",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recordedB.handlers,
    );

    b.resolve(
      okPage([event("b1", "Exposition", "2026-10-03T20:00:00+02:00")]),
    );
    await loadB;

    expect(recordedB.calls.success).toHaveLength(1);
    expect(recordedB.calls.success[0]?.events.map((e) => e.id)).toEqual([
      "b1",
    ]);
    expect(recordedB.calls.error).toEqual([]);
    expect(recordedB.calls.loading).toEqual([true, false]);

    a.resolve(okPage([event("a1", "Musique", "2026-10-03T20:00:00+02:00")]));
    await loadA;

    expect(recordedA.calls.success).toEqual([]);
    expect(recordedA.calls.error).toEqual([]);
    expect(recordedB.calls.success).toHaveLength(1);
  });

  it("n’efface pas le résultat courant si une ancienne requête échoue", async () => {
    const gen = { current: 0 };
    const begin = () => {
      const id = ++gen.current;
      return () => id === gen.current;
    };

    const stale = deferred<LoadExplorerEventsResult>();
    const current = deferred<LoadExplorerEventsResult>();

    const load = vi.fn<LoadFn>(async (input) => {
      if (input.category === "Musique") return stale.promise;
      return current.promise;
    });

    const recordedStale = recordHandlers(begin());
    const staleLoad = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recordedStale.handlers,
    );

    const recordedCurrent = recordHandlers(begin());
    const currentLoad = runFriseEventsReload(
      {
        category: "Exposition",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recordedCurrent.handlers,
    );

    current.resolve(
      okPage([event("fresh", "Exposition", "2026-10-03T20:00:00+02:00")]),
    );
    await currentLoad;

    expect(recordedCurrent.calls.success).toHaveLength(1);
    expect(recordedCurrent.calls.error).toEqual([]);

    stale.resolve({ ok: false, error: "Période invalide." });
    await staleLoad;

    expect(recordedStale.calls.success).toEqual([]);
    expect(recordedStale.calls.error).toEqual([]);
    expect(recordedCurrent.calls.success).toHaveLength(1);
    expect(recordedCurrent.calls.error).toEqual([]);
  });

  it("n’enchaîne pas une 2ᵉ page après invalidation", async () => {
    const gen = { current: 0 };
    const id = ++gen.current;
    const isCurrent = () => id === gen.current;

    const page1 = deferred<LoadExplorerEventsResult>();
    const load = vi.fn<LoadFn>(async () => page1.promise);

    const recorded = recordHandlers(isCurrent);
    const run = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recorded.handlers,
    );

    gen.current += 1;
    page1.resolve(
      okPage(
        [event("p1", "Musique", "2026-09-05T20:00:00+02:00")],
        80,
        "cursor-page-2",
      ),
    );
    await run;

    expect(load).toHaveBeenCalledTimes(1);
    expect(recorded.calls.success).toEqual([]);
    expect(recorded.calls.error).toEqual([]);
    expect(recorded.calls.loading).toEqual([true]);
  });

  it("ignore le commit après invalidation (cleanup / disable)", async () => {
    const gen = { current: 0 };
    const id = ++gen.current;
    const isCurrent = () => id === gen.current;

    const pending = deferred<LoadExplorerEventsResult>();
    const load = vi.fn<LoadFn>(async () => pending.promise);
    const recorded = recordHandlers(isCurrent);

    const run = runFriseEventsReload(
      {
        category: "Musique",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recorded.handlers,
    );

    gen.current += 1;
    pending.resolve(
      okPage([event("late", "Musique", "2026-09-05T20:00:00+02:00")]),
    );
    await run;

    expect(recorded.calls.success).toEqual([]);
    expect(recorded.calls.error).toEqual([]);
    expect(recorded.calls.loading).toEqual([true]);
  });
});
