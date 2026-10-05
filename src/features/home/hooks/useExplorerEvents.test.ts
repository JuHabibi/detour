import { describe, expect, it, vi } from "vitest";
import type {
  LoadExplorerEventsInput,
  LoadExplorerEventsResult,
} from "@/app/actions/load-explorer-events";
import type { EventItem } from "@/data/types";
import {
  appendExplorerEventsUnique,
  createExplorerLoadSession,
  EXPLORER_LOAD_FALLBACK_ERROR,
  runExplorerLoadMore,
  runExplorerPageOneLoad,
  type ExplorerListSnapshot,
} from "@/features/home/hooks/useExplorerEvents";

type LoadFn = (
  input: LoadExplorerEventsInput,
) => Promise<LoadExplorerEventsResult>;

function event(id: string): EventItem {
  return {
    id,
    title: id,
    category: "Musique",
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    date: "2026-10-05",
    dateLabel: "2026-10-05",
  };
}

function okPage(
  events: EventItem[],
  totalCount: number | null = events.length,
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

const baseFilters = {
  when: "upcoming" as const,
  category: "tout" as const,
  city: null,
  search: "",
};

describe("appendExplorerEventsUnique", () => {
  it("conserve l’ordre et ignore les doublons déjà présents ou internes", () => {
    const previous = [event("a"), event("b")];
    const incoming = [event("b"), event("c"), event("c"), event("d")];
    expect(appendExplorerEventsUnique(previous, incoming).map((e) => e.id)).toEqual(
      ["a", "b", "c", "d"],
    );
  });
});

describe("createExplorerLoadSession", () => {
  it("A → B → A : la première requête A reste obsolète", () => {
    const session = createExplorerLoadSession();
    const a1 = session.beginPageOne();
    const b = session.beginPageOne();
    expect(a1.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(true);
    const a2 = session.beginPageOne();
    expect(a1.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(false);
    expect(a2.isCurrent()).toBe(true);
  });

  it("beginPageOne invalide un Voir plus en cours", () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const more = session.beginLoadMore();
    expect(more).not.toBeNull();
    session.beginPageOne();
    expect(more!.isCurrent()).toBe(false);
    expect(session.beginLoadMore()).not.toBeNull();
  });

  it("refuse un second Voir plus tant que le verrou n’est pas libéré", () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const first = session.beginLoadMore();
    expect(first).not.toBeNull();
    expect(session.beginLoadMore()).toBeNull();
    first!.release();
    expect(session.beginLoadMore()).not.toBeNull();
  });
});

describe("runExplorerPageOneLoad — concurrence", () => {
  it("deux rechargements identiques : seul le dernier applique le résultat", async () => {
    const session = createExplorerLoadSession();
    const first = deferred<LoadExplorerEventsResult>();
    const second = deferred<LoadExplorerEventsResult>();
    let call = 0;
    const load = vi.fn<LoadFn>(async () => {
      call += 1;
      return call === 1 ? first.promise : second.promise;
    });

    const settled: ExplorerListSnapshot[] = [];
    const loading: boolean[] = [];

    const pageA = session.beginPageOne();
    const loadA = runExplorerPageOneLoad(
      { filters: baseFilters, load },
      {
        isCurrent: pageA.isCurrent,
        onLoading: (v) => loading.push(v),
        onSettled: (snapshot) => settled.push(snapshot),
      },
    );

    const pageB = session.beginPageOne();
    const loadB = runExplorerPageOneLoad(
      { filters: baseFilters, load },
      {
        isCurrent: pageB.isCurrent,
        onLoading: (v) => loading.push(v),
        onSettled: (snapshot) => settled.push(snapshot),
      },
    );

    second.resolve(okPage([event("new")], 1, null));
    await loadB;
    first.resolve(okPage([event("stale")], 1, null));
    await loadA;

    expect(settled).toHaveLength(1);
    expect(settled[0]?.events.map((e) => e.id)).toEqual(["new"]);
    expect(pageA.isCurrent()).toBe(false);
    expect(pageB.isCurrent()).toBe(true);
    // La requête obsolète ne termine pas le loading du rechargement courant.
    expect(loading.filter((v) => v === false)).toHaveLength(1);
  });

  it("A → B → A : réponse tardive de la première A ignorée", async () => {
    const session = createExplorerLoadSession();
    const a1 = deferred<LoadExplorerEventsResult>();
    const b = deferred<LoadExplorerEventsResult>();
    const a2 = deferred<LoadExplorerEventsResult>();
    let musiqueCalls = 0;

    const load = vi.fn<LoadFn>(async (input) => {
      if (input.category === "Exposition") return b.promise;
      musiqueCalls += 1;
      return musiqueCalls === 1 ? a1.promise : a2.promise;
    });

    const settled: string[] = [];
    const musique = { ...baseFilters, category: "Musique" as const };
    const exposition = { ...baseFilters, category: "Exposition" as const };

    const pageA1 = session.beginPageOne();
    const runA1 = runExplorerPageOneLoad(
      { filters: musique, load },
      {
        isCurrent: pageA1.isCurrent,
        onLoading: vi.fn(),
        onSettled: (s) => settled.push(`a1:${s.events[0]?.id}`),
      },
    );

    const pageB = session.beginPageOne();
    const runB = runExplorerPageOneLoad(
      { filters: exposition, load },
      {
        isCurrent: pageB.isCurrent,
        onLoading: vi.fn(),
        onSettled: (s) => settled.push(`b:${s.events[0]?.id}`),
      },
    );

    const pageA2 = session.beginPageOne();
    const runA2 = runExplorerPageOneLoad(
      { filters: musique, load },
      {
        isCurrent: pageA2.isCurrent,
        onLoading: vi.fn(),
        onSettled: (s) => settled.push(`a2:${s.events[0]?.id}`),
      },
    );

    b.resolve(okPage([event("b1")]));
    await runB;
    a1.resolve(okPage([event("a-old")]));
    await runA1;
    a2.resolve(okPage([event("a-new")]));
    await runA2;

    expect(settled).toEqual(["a2:a-new"]);
  });

  it("invalidate (démontage) : aucun commit ni loading false obsolète", async () => {
    const session = createExplorerLoadSession();
    const pending = deferred<LoadExplorerEventsResult>();
    const load = vi.fn<LoadFn>(async () => pending.promise);
    const settled = vi.fn();
    const loading: boolean[] = [];

    const page = session.beginPageOne();
    const run = runExplorerPageOneLoad(
      { filters: baseFilters, load },
      {
        isCurrent: page.isCurrent,
        onLoading: (v) => loading.push(v),
        onSettled: settled,
      },
    );

    session.invalidate();
    pending.resolve(okPage([event("x")]));
    await run;

    expect(settled).not.toHaveBeenCalled();
    expect(loading).toEqual([true]);
  });
});

describe("runExplorerLoadMore — pagination", () => {
  it("pagination invalidée par un rechargement page 1", async () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const pending = deferred<LoadExplorerEventsResult>();
    const load = vi.fn<LoadFn>(async () => pending.promise);

    const handle = session.beginLoadMore();
    expect(handle).not.toBeNull();

    const onAppend = vi.fn();
    const onError = vi.fn();
    const loadingMore: boolean[] = [];

    const more = runExplorerLoadMore(
      { filters: baseFilters, cursor: "c1", load },
      {
        isCurrent: handle!.isCurrent,
        release: handle!.release,
        onLoadingMore: (v) => loadingMore.push(v),
        onAppend,
        onError,
      },
    );

    session.beginPageOne();
    pending.resolve(okPage([event("page2")], 10, "c2"));
    await more;

    expect(onAppend).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(loadingMore).toEqual([true]);
  });

  it("appels répétés : un seul chargement accepté", async () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const pending = deferred<LoadExplorerEventsResult>();
    const load = vi.fn<LoadFn>(async () => pending.promise);

    const first = session.beginLoadMore();
    const second = session.beginLoadMore();
    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const onAppend = vi.fn();
    const more = runExplorerLoadMore(
      { filters: baseFilters, cursor: "c1", load },
      {
        isCurrent: first!.isCurrent,
        release: first!.release,
        onLoadingMore: vi.fn(),
        onAppend,
        onError: vi.fn(),
      },
    );

    pending.resolve(okPage([event("p2")], 2, null));
    await more;

    expect(load).toHaveBeenCalledTimes(1);
    expect(onAppend).toHaveBeenCalledTimes(1);
  });

  it("doublons entre pages et dans la réponse via appendExplorerEventsUnique", async () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const handle = session.beginLoadMore();
    const load = vi.fn<LoadFn>(async () =>
      okPage([event("b"), event("c"), event("c")], 5, null),
    );

    let events = [event("a"), event("b")];
    await runExplorerLoadMore(
      { filters: baseFilters, cursor: "c1", load },
      {
        isCurrent: handle!.isCurrent,
        release: handle!.release,
        onLoadingMore: vi.fn(),
        onAppend: (data) => {
          events = appendExplorerEventsUnique(events, data.events);
        },
        onError: vi.fn(),
      },
    );

    expect(events.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("rejet réseau : liste intacte, verrou libéré, nouvel essai possible", async () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const load = vi.fn<LoadFn>(async () => {
      throw new Error("network");
    });

    const handle = session.beginLoadMore();
    const onAppend = vi.fn();
    const onError = vi.fn();
    const loadingMore: boolean[] = [];
    const existing = [event("keep")];

    await runExplorerLoadMore(
      { filters: baseFilters, cursor: "c1", load },
      {
        isCurrent: handle!.isCurrent,
        release: handle!.release,
        onLoadingMore: (v) => loadingMore.push(v),
        onAppend,
        onError,
      },
    );

    expect(onAppend).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(EXPLORER_LOAD_FALLBACK_ERROR);
    expect(existing.map((e) => e.id)).toEqual(["keep"]);
    expect(loadingMore).toEqual([true, false]);
    expect(session.beginLoadMore()).not.toBeNull();
  });

  it("ok:false : erreur sans wipe, nouvel essai possible", async () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const handle = session.beginLoadMore();
    const onAppend = vi.fn();
    const onError = vi.fn();

    await runExplorerLoadMore(
      {
        filters: baseFilters,
        cursor: "c1",
        load: async () => ({ ok: false, error: "Timeout source." }),
      },
      {
        isCurrent: handle!.isCurrent,
        release: handle!.release,
        onLoadingMore: vi.fn(),
        onAppend,
        onError,
      },
    );

    expect(onAppend).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Timeout source.");
    expect(session.beginLoadMore()).not.toBeNull();
  });

  it("append : n’expose pas totalCount (conservation côté hook)", async () => {
    const session = createExplorerLoadSession();
    session.beginPageOne();
    const handle = session.beginLoadMore();
    const onAppend = vi.fn();

    await runExplorerLoadMore(
      {
        filters: baseFilters,
        cursor: "c1",
        load: async () => okPage([event("p2")], null, "c2"),
      },
      {
        isCurrent: handle!.isCurrent,
        release: handle!.release,
        onLoadingMore: vi.fn(),
        onAppend,
        onError: vi.fn(),
      },
    );

    expect(onAppend).toHaveBeenCalledWith({
      events: [event("p2")],
      nextCursor: "c2",
    });
    expect(onAppend.mock.calls[0]?.[0]).not.toHaveProperty("totalCount");
  });
});

describe("runExplorerPageOneLoad — totalCount requis", () => {
  it("totalCount absent sur première page → erreur contrôlée", async () => {
    const session = createExplorerLoadSession();
    const page = session.beginPageOne();
    const settled: ExplorerListSnapshot[] = [];

    await runExplorerPageOneLoad(
      {
        filters: baseFilters,
        load: async () => ({
          ok: true,
          events: [event("x")],
          totalCount: null,
          nextCursor: null,
        }),
      },
      {
        isCurrent: page.isCurrent,
        onLoading: vi.fn(),
        onSettled: (snapshot) => settled.push(snapshot),
      },
    );

    expect(settled).toEqual([
      {
        events: [],
        totalCount: 0,
        nextCursor: null,
        error: EXPLORER_LOAD_FALLBACK_ERROR,
      },
    ]);
  });

  it("totalCount 0 est un succès valide", async () => {
    const session = createExplorerLoadSession();
    const page = session.beginPageOne();
    const settled: ExplorerListSnapshot[] = [];

    await runExplorerPageOneLoad(
      {
        filters: baseFilters,
        load: async () => okPage([], 0, null),
      },
      {
        isCurrent: page.isCurrent,
        onLoading: vi.fn(),
        onSettled: (snapshot) => settled.push(snapshot),
      },
    );

    expect(settled).toEqual([
      { events: [], totalCount: 0, nextCursor: null, error: null },
    ]);
  });
});
