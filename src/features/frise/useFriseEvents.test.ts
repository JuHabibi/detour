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
      { category: "Musique", city: null, search: "", load },
      recordedA.handlers,
    );

    const recordedB = recordHandlers(begin());
    const loadB = runFriseEventsReload(
      { category: "Exposition", city: null, search: "", load },
      recordedB.handlers,
    );

    b.resolve(okPage([event("b1", "Exposition")], 1));
    await loadB;

    expect(recordedB.calls.success).toHaveLength(1);
    expect(recordedB.calls.success[0]?.events.map((e) => e.id)).toEqual([
      "b1",
    ]);
    expect(recordedB.calls.error).toEqual([]);
    expect(recordedB.calls.loading).toEqual([true, false]);

    a.resolve(okPage([event("a1", "Musique")], 1));
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
      { category: "Musique", city: null, search: "", load },
      recordedStale.handlers,
    );

    const recordedCurrent = recordHandlers(begin());
    const currentLoad = runFriseEventsReload(
      { category: "Exposition", city: null, search: "", load },
      recordedCurrent.handlers,
    );

    current.resolve(okPage([event("fresh", "Exposition")], 1));
    await currentLoad;

    expect(recordedCurrent.calls.success).toHaveLength(1);
    expect(recordedCurrent.calls.success[0]?.events.map((e) => e.id)).toEqual([
      "fresh",
    ]);
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
      { category: "Musique", city: null, search: "", load },
      recorded.handlers,
    );

    gen.current += 1;
    page1.resolve(
      okPage([event("p1", "Musique")], 80, "cursor-page-2"),
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
      { category: "Musique", city: null, search: "", load },
      recorded.handlers,
    );

    gen.current += 1;
    pending.resolve(okPage([event("late", "Musique")]));
    await run;

    expect(recorded.calls.success).toEqual([]);
    expect(recorded.calls.error).toEqual([]);
    expect(recorded.calls.loading).toEqual([true]);
  });
});
