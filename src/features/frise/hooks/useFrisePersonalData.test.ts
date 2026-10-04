import { describe, expect, it, vi } from "vitest";
import type { EventItem } from "@/data/types";
import type { GroupSummary } from "@/application/groups";

vi.mock("@/app/actions/favorites", () => ({
  listMyFavoriteEventIds: vi.fn(),
  listMyFavoriteEvents: vi.fn(),
}));

vi.mock("@/app/actions/groups", () => ({
  getMyCarnetEvents: vi.fn(),
  listMyCarnetsState: vi.fn(),
}));

import type {
  ListMyFavoriteEventIdsResult,
  ListMyFavoriteEventsResult,
} from "@/app/actions/favorites";
import type {
  GetMyCarnetEventsResult,
  ListMyCarnetsStateResult,
} from "@/app/actions/groups";
import {
  createFavoriteIdsAuthority,
  createRequestGate,
  removeEventFromPersonalCorpora,
  runCarnetEventsLoad,
  runCarnetsListLoad,
  runFavoriteEventsLoad,
  runFavoriteIdsLoad,
} from "@/features/frise/hooks/useFrisePersonalData";

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
    time: "20h00",
  };
}

function group(id: string, name: string): GroupSummary {
  return {
    id,
    userId: "user-1",
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    eventCount: 0,
    earliestStartAt: null,
    latestStartAt: null,
  };
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

describe("createRequestGate", () => {
  it("invalide la génération précédente sans toucher une autre gate", () => {
    const a = createRequestGate();
    const b = createRequestGate();
    const a1 = a.begin();
    const b1 = b.begin();
    expect(a1.isCurrent()).toBe(true);
    expect(b1.isCurrent()).toBe(true);
    a.invalidate();
    expect(a1.isCurrent()).toBe(false);
    expect(b1.isCurrent()).toBe(true);
  });
});

describe("runFavoriteIdsLoad", () => {
  it("succès → IDs", async () => {
    const gate = createRequestGate().begin();
    const onSuccess = vi.fn();
    await runFavoriteIdsLoad(
      async () => ({ ok: true, eventIds: ["e1", "e2"] }),
      { isCurrent: gate.isCurrent, onLoading: vi.fn(), onSuccess },
    );
    expect(onSuccess).toHaveBeenCalledWith(["e1", "e2"]);
  });

  it("ok:false → tableau vide", async () => {
    const gate = createRequestGate().begin();
    const onSuccess = vi.fn();
    await runFavoriteIdsLoad(
      async () => ({ ok: false, reason: "error" }),
      { isCurrent: gate.isCurrent, onLoading: vi.fn(), onSuccess },
    );
    expect(onSuccess).toHaveBeenCalledWith([]);
  });

  it("rejet réseau → tableau vide", async () => {
    const gate = createRequestGate().begin();
    const onSuccess = vi.fn();
    await runFavoriteIdsLoad(
      async () => {
        throw new Error("network");
      },
      { isCurrent: gate.isCurrent, onLoading: vi.fn(), onSuccess },
    );
    expect(onSuccess).toHaveBeenCalledWith([]);
  });

  it("réponse obsolète après invalidate → aucun commit", async () => {
    const requestGate = createRequestGate();
    const gate = requestGate.begin();
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const onSuccess = vi.fn();

    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: gate.isCurrent,
      onLoading: vi.fn(),
      onSuccess,
    });

    requestGate.invalidate();
    pending.resolve({ ok: true, eventIds: ["stale"] });
    await load;

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("autorité bumpée (contenu / mutation) → IDs tardifs ignorés", async () => {
    const requestGate = createRequestGate();
    const authority = createFavoriteIdsAuthority();
    const gate = requestGate.begin();
    const auth = authority.capture();
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const onSuccess = vi.fn();

    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: () => gate.isCurrent() && auth.isAuthoritative(),
      onLoading: vi.fn(),
      onSuccess,
    });

    authority.bump();
    pending.resolve({ ok: true, eventIds: ["stale-ids"] });
    await load;

    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("runFavoriteEventsLoad", () => {
  it("succès → events + fin de chargement", async () => {
    const gate = createRequestGate().begin();
    const loading: boolean[] = [];
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await runFavoriteEventsLoad(
      async () => ({ ok: true, events: [event("f1")] }),
      {
        isCurrent: gate.isCurrent,
        onLoading: (v) => loading.push(v),
        onSuccess,
        onError,
      },
    );

    expect(onSuccess).toHaveBeenCalledWith([event("f1")]);
    expect(onError).not.toHaveBeenCalled();
    expect(loading).toEqual([true, false]);
  });

  it("ok:false → erreur et fin de chargement", async () => {
    const gate = createRequestGate().begin();
    const loading: boolean[] = [];
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await runFavoriteEventsLoad(
      async () => ({ ok: false, reason: "error" }),
      {
        isCurrent: gate.isCurrent,
        onLoading: (v) => loading.push(v),
        onSuccess,
        onError,
      },
    );

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Impossible de charger vos favoris.");
    expect(loading).toEqual([true, false]);
  });

  it("rejet → erreur et fin de chargement", async () => {
    const gate = createRequestGate().begin();
    const loading: boolean[] = [];
    const onError = vi.fn();

    await runFavoriteEventsLoad(
      async () => {
        throw new Error("boom");
      },
      {
        isCurrent: gate.isCurrent,
        onLoading: (v) => loading.push(v),
        onSuccess: vi.fn(),
        onError,
      },
    );

    expect(onError).toHaveBeenCalledWith("Impossible de charger vos favoris.");
    expect(loading).toEqual([true, false]);
  });

  it("sortie de vue (invalidate) → pas de commit ni loading bloqué côté handler courant", async () => {
    const requestGate = createRequestGate();
    const gate = requestGate.begin();
    const pending = deferred<ListMyFavoriteEventsResult>();
    const loading: boolean[] = [];
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const load = runFavoriteEventsLoad(() => pending.promise, {
      isCurrent: gate.isCurrent,
      onLoading: (v) => loading.push(v),
      onSuccess,
      onError,
    });

    expect(loading).toEqual([true]);
    requestGate.invalidate();
    // La page / le hook remet loading à false à la sortie de vue.
    pending.resolve({ ok: true, events: [event("late")] });
    await load;

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(loading).toEqual([true]);
  });
});

describe("runCarnetsListLoad", () => {
  it("succès → groups", async () => {
    const gate = createRequestGate().begin();
    const onSuccess = vi.fn();
    await runCarnetsListLoad(
      async () => ({
        ok: true,
        groups: [group("g1", "Automne")],
        memberships: [],
      }),
      {
        isCurrent: gate.isCurrent,
        onLoading: vi.fn(),
        onSuccess,
        onError: vi.fn(),
      },
    );
    expect(onSuccess).toHaveBeenCalledWith([group("g1", "Automne")]);
  });

  it("ok:false et rejet → onError + fin de chargement", async () => {
    const gate = createRequestGate().begin();
    const loading: boolean[] = [];
    const onError = vi.fn();

    await runCarnetsListLoad(
      async () => ({ ok: false, reason: "error" }),
      {
        isCurrent: gate.isCurrent,
        onLoading: (v) => loading.push(v),
        onSuccess: vi.fn(),
        onError,
      },
    );
    expect(onError).toHaveBeenCalledOnce();
    expect(loading).toEqual([true, false]);

    const gate2 = createRequestGate().begin();
    const loading2: boolean[] = [];
    const onError2 = vi.fn();
    await runCarnetsListLoad(
      async () => {
        throw new Error("net");
      },
      {
        isCurrent: gate2.isCurrent,
        onLoading: (v) => loading2.push(v),
        onSuccess: vi.fn(),
        onError: onError2,
      },
    );
    expect(onError2).toHaveBeenCalledOnce();
    expect(loading2).toEqual([true, false]);
  });
});

describe("runCarnetEventsLoad — concurrence", () => {
  it("A → B : réponse tardive de A n’écrase pas B", async () => {
    const requestGate = createRequestGate();
    const a = deferred<GetMyCarnetEventsResult>();
    const b = deferred<GetMyCarnetEventsResult>();

    const gateA = requestGate.begin();
    const callsA = { success: 0, error: 0, loading: [] as boolean[] };
    const loadA = runCarnetEventsLoad("carnet-a", () => a.promise, {
      isCurrent: gateA.isCurrent,
      onLoading: (v) => callsA.loading.push(v),
      onSuccess: () => {
        callsA.success += 1;
      },
      onError: () => {
        callsA.error += 1;
      },
    });

    requestGate.invalidate();
    const gateB = requestGate.begin();
    const callsB = {
      success: [] as string[],
      error: 0,
      loading: [] as boolean[],
    };
    const loadB = runCarnetEventsLoad("carnet-b", () => b.promise, {
      isCurrent: gateB.isCurrent,
      onLoading: (v) => callsB.loading.push(v),
      onSuccess: (data) => {
        callsB.success.push(data.name);
      },
      onError: () => {
        callsB.error += 1;
      },
    });

    b.resolve({
      ok: true,
      group: { id: "carnet-b", name: "B" },
      events: [event("b1")],
    });
    await loadB;

    a.resolve({
      ok: true,
      group: { id: "carnet-a", name: "A" },
      events: [event("a1")],
    });
    await loadA;

    expect(callsB.success).toEqual(["B"]);
    expect(callsB.error).toBe(0);
    expect(callsB.loading).toEqual([true, false]);
    expect(callsA.success).toBe(0);
    expect(callsA.error).toBe(0);
  });

  it("A → B → A : la première requête A reste obsolète", async () => {
    const requestGate = createRequestGate();
    const a1 = deferred<GetMyCarnetEventsResult>();
    const b = deferred<GetMyCarnetEventsResult>();
    const a2 = deferred<GetMyCarnetEventsResult>();

    const applied: string[] = [];

    const gateA1 = requestGate.begin();
    const loadA1 = runCarnetEventsLoad("carnet-a", () => a1.promise, {
      isCurrent: gateA1.isCurrent,
      onLoading: vi.fn(),
      onSuccess: (data) => applied.push(`a1:${data.name}`),
      onError: vi.fn(),
    });

    requestGate.invalidate();
    const gateB = requestGate.begin();
    const loadB = runCarnetEventsLoad("carnet-b", () => b.promise, {
      isCurrent: gateB.isCurrent,
      onLoading: vi.fn(),
      onSuccess: (data) => applied.push(`b:${data.name}`),
      onError: vi.fn(),
    });

    requestGate.invalidate();
    const gateA2 = requestGate.begin();
    const loadA2 = runCarnetEventsLoad("carnet-a", () => a2.promise, {
      isCurrent: gateA2.isCurrent,
      onLoading: vi.fn(),
      onSuccess: (data) => applied.push(`a2:${data.name}`),
      onError: vi.fn(),
    });

    b.resolve({
      ok: true,
      group: { id: "carnet-b", name: "B" },
      events: [],
    });
    await loadB;

    a1.resolve({
      ok: true,
      group: { id: "carnet-a", name: "A-old" },
      events: [event("old")],
    });
    await loadA1;

    a2.resolve({
      ok: true,
      group: { id: "carnet-a", name: "A-new" },
      events: [event("new")],
    });
    await loadA2;

    expect(applied).toEqual(["a2:A-new"]);
  });

  it("not_found → missing true + fin de chargement", async () => {
    const gate = createRequestGate().begin();
    const loading: boolean[] = [];
    const onError = vi.fn();

    await runCarnetEventsLoad(
      "missing",
      async () => ({ ok: false, reason: "not_found" }),
      {
        isCurrent: gate.isCurrent,
        onLoading: (v) => loading.push(v),
        onSuccess: vi.fn(),
        onError,
      },
    );

    expect(onError).toHaveBeenCalledWith({
      message: "Ce carnet est introuvable.",
      missing: true,
    });
    expect(loading).toEqual([true, false]);
  });

  it("invalidate pendant le chargement → pas de fin de loading via la requête obsolète", async () => {
    const requestGate = createRequestGate();
    const gate = requestGate.begin();
    const pending = deferred<GetMyCarnetEventsResult>();
    const loading: boolean[] = [];

    const load = runCarnetEventsLoad("carnet-a", () => pending.promise, {
      isCurrent: gate.isCurrent,
      onLoading: (v) => loading.push(v),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(loading).toEqual([true]);
    requestGate.invalidate();
    pending.resolve({
      ok: true,
      group: { id: "carnet-a", name: "A" },
      events: [],
    });
    await load;

    expect(loading).toEqual([true]);
  });
});

describe("cohérence locale des favoris (helpers utilisés par le hook)", () => {
  it("removeEventFromPersonalCorpora : IDs + corpus favoris + corpus carnet", () => {
    const authority = createFavoriteIdsAuthority();
    const authBefore = authority.capture();

    // Même ordre que removeEventLocally : bump puis transformation des corpora.
    authority.bump();
    const next = removeEventFromPersonalCorpora("gone", {
      ids: new Set(["keep", "gone"]),
      favoriteEvents: [event("keep"), event("gone")],
      notebookEvents: [event("gone"), event("other")],
    });

    expect(authBefore.isAuthoritative()).toBe(false);
    expect([...next.ids]).toEqual(["keep"]);
    expect(next.favoriteEvents.map((e) => e.id)).toEqual(["keep"]);
    expect(next.notebookEvents.map((e) => e.id)).toEqual(["other"]);
  });

  it("gates indépendantes : carnets n’invalide pas les favoris", async () => {
    const favoritesGate = createRequestGate();
    const carnetsGate = createRequestGate();
    const fav = favoritesGate.begin();
    const car = carnetsGate.begin();

    const pendingFav = deferred<ListMyFavoriteEventsResult>();
    const pendingCar = deferred<ListMyCarnetsStateResult>();
    const favSuccess = vi.fn();
    const carSuccess = vi.fn();

    const loadFav = runFavoriteEventsLoad(() => pendingFav.promise, {
      isCurrent: fav.isCurrent,
      onLoading: vi.fn(),
      onSuccess: favSuccess,
      onError: vi.fn(),
    });
    const loadCar = runCarnetsListLoad(() => pendingCar.promise, {
      isCurrent: car.isCurrent,
      onLoading: vi.fn(),
      onSuccess: carSuccess,
      onError: vi.fn(),
    });

    carnetsGate.invalidate();
    pendingCar.resolve({
      ok: true,
      groups: [group("g1", "G")],
      memberships: [],
    });
    await loadCar;
    expect(carSuccess).not.toHaveBeenCalled();

    pendingFav.resolve({ ok: true, events: [event("f1")] });
    await loadFav;
    expect(favSuccess).toHaveBeenCalledWith([event("f1")]);
  });
});
