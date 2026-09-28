import { describe, expect, it, vi } from "vitest";
import type {
  LoadExplorerEventsInput,
  LoadExplorerEventsResult,
} from "@/app/actions/load-explorer-events";
import type { EventItem } from "@/data/types";
import {
  buildExplorerFrieze,
  resolveFriezeWindow,
} from "@/features/frise/timeline/frise-timeline-model";
import {
  runFriseEventsReload,
  exposedFriseCoverageStatus,
  friseEventsReloadFailure,
  friseEventsReloadStart,
  friseEventsReloadSuccess,
  type FriseEventsLoadSuccess,
  type FriseEventsExposedSlice,
} from "@/features/frise/hooks/useFriseEvents";

type LoadFn = (
  input: LoadExplorerEventsInput,
) => Promise<LoadExplorerEventsResult>;

function event(
  id: string,
  category: EventItem["category"],
  startAt: string,
  endAt?: string,
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
    endAt,
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
  it("affiche une sortie dans la fenêtre même si >150 expos spanning précèdent", async () => {
    const gen = { current: 0 };
    const isCurrent = () => gen.current === 1;
    gen.current = 1;

    // Sous l’ancien filtre overlap, ces expos (début avant from, fin dans la fenêtre)
    // auraient rempli le plafond avant la vraie sortie du trimestre.
    const spanningFlood = Array.from({ length: 160 }, (_, i) =>
      event(
        `span-${i}`,
        "Exposition",
        "2026-08-01T10:00:00+02:00",
        "2026-10-15T18:00:00+02:00",
      ),
    );
    const inWindow = event(
      "oct-ouverture",
      "Exposition",
      "2026-10-10T18:00:00+02:00",
    );

    const load = vi.fn<LoadFn>(async (input) => {
      expect(input.from).toBe("2026-09-01");
      expect(input.to).toBe("2026-11-30");
      // Contrat serveur start-in-window : les spanning ne sont pas renvoyés.
      const startsInWindow = [...spanningFlood, inWindow].filter((e) => {
        const startAt = e.startAt;
        if (!startAt) return false;
        const key = startAt.slice(0, 10);
        return key >= input.from! && key <= input.to!;
      });
      return okPage(startsInWindow, startsInWindow.length);
    });

    const recorded = recordHandlers(isCurrent);
    await runFriseEventsReload(
      {
        category: "Exposition",
        city: null,
        search: "",
        from: "2026-09-01",
        to: "2026-11-30",
        load,
      },
      recorded.handlers,
    );

    expect(recorded.calls.success[0]?.events.map((e) => e.id)).toEqual([
      "oct-ouverture",
    ]);
    expect(recorded.calls.success[0]?.truncatedByCap).toBe(false);
  });

  it("après navigation, ignore le succès puis l’erreur de l’ancienne fenêtre", async () => {
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

    first.resolve({ ok: false, error: "Période invalide." });
    await loadA;
    expect(recordedA.calls.success).toEqual([]);
    expect(recordedA.calls.error).toEqual([]);
    expect(recordedB.calls.error).toEqual([]);
  });
});

describe("couverture vue ↔ données", () => {
  it("ne présente pas d’anciennes données comme vide du nouveau trimestre", async () => {
    const { resolveFriseCoverageStatus } = await import(
      "@/features/frise/timeline/frise-timeline-model"
    );
    const autumn = resolveFriezeWindow("2026-09-01");
    const winter = resolveFriezeWindow("2026-12-01");
    const autumnEvents = [
      event("sep", "Musique", "2026-09-20T20:00:00+02:00"),
    ];

    // Pendant le chargement de l’hiver : settled encore automne.
    const pendingStatus = resolveFriseCoverageStatus({
      viewFrom: winter.fromKey,
      viewTo: winter.toKey,
      viewCategory: "Musique",
      viewCity: null,
      viewSearch: "",
      settled: {
        from: autumn.fromKey,
        to: autumn.toKey,
        category: "Musique",
        city: null,
        search: "",
        status: "complete",
      },
    });
    expect(pendingStatus).toBe("pending");

    const pendingModel = buildExplorerFrieze({
      events: [],
      window: winter,
      fetchedCount: 0,
      truncatedByCap: false,
      coverageStatus: pendingStatus,
    });
    expect(
      pendingModel.chapters
        .flatMap((c) => c.items)
        .some((i) => i.kind === "quiet" && i.label.includes("Aucune sortie")),
    ).toBe(false);

    // Les événements automne filtrés sur la fenêtre hiver → 0, mais ce n’est
    // pas la couverture « complete » : on n’affiche pas « Aucune sortie ».
    const mistakenEmpty = buildExplorerFrieze({
      events: autumnEvents,
      window: winter,
      fetchedCount: autumnEvents.length,
      truncatedByCap: false,
      coverageStatus: "pending",
    });
    expect(mistakenEmpty.eventCountInWindow).toBe(0);
    expect(
      mistakenEmpty.chapters
        .flatMap((c) => c.items)
        .some((i) => i.kind === "quiet" && i.label.includes("Aucune sortie")),
    ).toBe(false);

    // Erreur sur la fenêtre hiver.
    const errorModel = buildExplorerFrieze({
      events: [],
      window: winter,
      fetchedCount: 0,
      truncatedByCap: false,
      coverageStatus: "error",
    });
    expect(
      errorModel.chapters
        .flatMap((c) => c.items)
        .some((i) => i.kind === "quiet" && i.label.includes("Aucune sortie")),
    ).toBe(false);
  });

  it("n’affiche « Aucune sortie » qu’après une réponse complete", () => {
    const window = resolveFriezeWindow("2026-09-01");
    const complete = buildExplorerFrieze({
      events: [],
      window,
      fetchedCount: 0,
      truncatedByCap: false,
      coverageStatus: "complete",
    });
    expect(
      complete.chapters.some((c) =>
        c.items.some(
          (i) => i.kind === "quiet" && i.label === "Aucune sortie ce mois-ci",
        ),
      ),
    ).toBe(true);
  });

  it("city ou search changés à trimestre/catégorie identiques → pas complete", async () => {
    const { resolveFriseCoverageStatus } = await import(
      "@/features/frise/timeline/frise-timeline-model"
    );
    const window = resolveFriezeWindow("2026-09-01");
    const settled = {
      from: window.fromKey,
      to: window.toKey,
      category: "Musique",
      city: null as string | null,
      search: "",
      status: "complete" as const,
    };

    expect(
      resolveFriseCoverageStatus({
        viewFrom: window.fromKey,
        viewTo: window.toKey,
        viewCategory: "Musique",
        viewCity: "Orléans",
        viewSearch: "",
        settled,
      }),
    ).toBe("pending");

    expect(
      resolveFriseCoverageStatus({
        viewFrom: window.fromKey,
        viewTo: window.toKey,
        viewCategory: "Musique",
        viewCity: null,
        viewSearch: "jazz",
        settled,
      }),
    ).toBe("pending");

    const pendingModel = buildExplorerFrieze({
      events: [event("old", "Musique", "2026-09-20T20:00:00+02:00")],
      window,
      fetchedCount: 1,
      truncatedByCap: false,
      coverageStatus: "pending",
    });
    expect(
      pendingModel.chapters
        .flatMap((c) => c.items)
        .some((i) => i.kind === "quiet" && i.label.includes("Aucune sortie")),
    ).toBe(false);
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
    expect(recordedCurrent.calls.loading).toEqual([true, false]);

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

describe("retry fenêtre courante — coverage exposée par le hook", () => {
  const view = {
    from: "2026-09-01",
    to: "2026-11-30",
    category: "Spectacle",
    city: null as string | null,
    search: "",
  };

  function coverage(slice: FriseEventsExposedSlice) {
    // Même résolution que `model.coverageStatus` dans useFriseEvents.
    return exposedFriseCoverageStatus(view, slice);
  }

  it("error → pending → complete (ready)", () => {
    let slice = friseEventsReloadFailure(view, "Impossible de charger la promenade.");
    expect(coverage(slice)).toBe("error");
    expect(slice.error).toBe("Impossible de charger la promenade.");

    slice = friseEventsReloadStart();
    expect(coverage(slice)).toBe("pending");
    expect(slice.error).toBeNull();
    expect(slice.settled).toBeNull();

    slice = friseEventsReloadSuccess(view, false);
    expect(coverage(slice)).toBe("complete");
    expect(slice.error).toBeNull();
  });

  it("error → pending → error", () => {
    let slice = friseEventsReloadFailure(view, "Période invalide.");
    expect(coverage(slice)).toBe("error");

    slice = friseEventsReloadStart();
    expect(coverage(slice)).toBe("pending");

    slice = friseEventsReloadFailure(view, "Impossible de charger la promenade.");
    expect(coverage(slice)).toBe("error");
    expect(slice.error).toBe("Impossible de charger la promenade.");
  });

  it("conserve la protection anti-périmé : succès obsolète ignoré après nouveau start", async () => {
    const gen = { current: 0 };
    const staleId = ++gen.current;
    const staleIsCurrent = () => staleId === gen.current;

    const pending = deferred<LoadExplorerEventsResult>();
    const load = vi.fn<LoadFn>(async () => pending.promise);
    const recorded = recordHandlers(staleIsCurrent);

    // État error puis start → pending (comme reload du hook).
    let slice = friseEventsReloadFailure(view, "boom");
    slice = friseEventsReloadStart();
    expect(coverage(slice)).toBe("pending");

    const staleRun = runFriseEventsReload(
      {
        category: "Spectacle",
        city: null,
        search: "",
        from: view.from,
        to: view.to,
        load,
      },
      {
        ...recorded.handlers,
        onSuccess: (data) => {
          recorded.handlers.onSuccess(data);
          // Ne doit pas être appelé après invalidation.
          slice = friseEventsReloadSuccess(view, data.truncatedByCap);
        },
        onError: (message) => {
          recorded.handlers.onError(message);
          slice = friseEventsReloadFailure(view, message);
        },
      },
    );

    // Nouveau retry : invalide la génération (comme ++loadGenerationRef).
    gen.current += 1;
    const freshStart = friseEventsReloadStart();
    expect(exposedFriseCoverageStatus(view, freshStart)).toBe("pending");

    pending.resolve(
      okPage([event("late", "Spectacle", "2026-09-05T20:00:00+02:00")]),
    );
    await staleRun;

    expect(recorded.calls.success).toEqual([]);
    expect(recorded.calls.error).toEqual([]);
    // Coverage reste celle du start frais, pas un complete fantôme.
    expect(coverage(freshStart)).toBe("pending");
  });
});
