import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/favorites", () => ({
  listMyFavoriteEventIds: vi.fn(),
}));

vi.mock("@/app/actions/groups", () => ({
  listMyCarnetsState: vi.fn(),
}));

import type { ListMyFavoriteEventIdsResult } from "@/app/actions/favorites";
import type { ListMyCarnetsStateResult } from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import { countCarnetsByEventId } from "@/components/carnets/count-carnets-by-event-id";
import {
  carnetMembershipKey,
  createFavoriteIdsAuthority,
  createPersonalSessionGate,
  isCarnetsLoadActive,
  mergeCarnetsSnapshot,
  mergeFavoriteIds,
  runCarnetsLoad,
  runFavoriteIdsLoad,
  type CarnetsOverlay,
} from "@/components/personal/usePersonalData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

function membership(
  eventId: string,
  groupId: string,
  groupName: string,
): EventGroupMembership {
  return { eventId, groupId, groupName };
}

function emptyOverlay(
  partial?: Partial<{
    upsertedGroups: Map<string, GroupSummary>;
    upsertedMemberships: Map<string, EventGroupMembership>;
    removedMembershipKeys: Set<string>;
    excludedEventIds: Set<string>;
  }>,
): CarnetsOverlay {
  return {
    upsertedGroups: partial?.upsertedGroups ?? new Map(),
    upsertedMemberships: partial?.upsertedMemberships ?? new Map(),
    removedMembershipKeys: partial?.removedMembershipKeys ?? new Set(),
    excludedEventIds: partial?.excludedEventIds ?? new Set(),
  };
}

describe("mergeFavoriteIds", () => {
  it("conserve les favoris serveur non touchés et garde l’ajout local", () => {
    const merged = mergeFavoriteIds(["A", "B"], {
      added: new Set(["C"]),
      removed: new Set(),
    });
    expect([...merged].sort()).toEqual(["A", "B", "C"]);
  });

  it("n’autorise pas une réponse ancienne à réintroduire un favori retiré", () => {
    const merged = mergeFavoriteIds(["A", "B", "C"], {
      added: new Set(),
      removed: new Set(["C"]),
    });
    expect([...merged].sort()).toEqual(["A", "B"]);
  });
});

describe("mergeCarnetsSnapshot", () => {
  it("filtre les appartenances des événements retirés localement", () => {
    const merged = mergeCarnetsSnapshot(
      {
        groups: [group("g1", "G1")],
        memberships: [
          membership("A", "g1", "G1"),
          membership("C", "g1", "G1"),
          membership("B", "g1", "G1"),
        ],
      },
      emptyOverlay({ excludedEventIds: new Set(["C"]) }),
    );
    expect(merged.memberships.map((m) => m.eventId).sort()).toEqual(["A", "B"]);
  });

  it("modale crée G2+C pendant le load : conserve G1/A/B serveur et C→G2 local", () => {
    const g2 = group("g2", "G2");
    const cToG2 = membership("C", "g2", "G2");
    const overlay = emptyOverlay({
      upsertedGroups: new Map([["g2", g2]]),
      upsertedMemberships: new Map([
        [carnetMembershipKey("C", "g2"), cToG2],
      ]),
    });

    const merged = mergeCarnetsSnapshot(
      {
        groups: [group("g1", "G1")],
        memberships: [
          membership("A", "g1", "G1"),
          membership("B", "g1", "G1"),
        ],
      },
      overlay,
    );

    expect(merged.groups.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect(
      merged.memberships
        .map((m) => `${m.eventId}→${m.groupId}`)
        .sort(),
    ).toEqual(["A→g1", "B→g1", "C→g2"]);
    expect(Object.fromEntries(countCarnetsByEventId(merged.memberships))).toEqual({
      A: 1,
      B: 1,
      C: 1,
    });
  });
});

describe("createPersonalSessionGate", () => {
  it("invalide A → B → A : l’ancienne génération A ne redevient pas courante", () => {
    const gate = createPersonalSessionGate();
    const firstA = gate.begin();
    expect(firstA.isCurrent()).toBe(true);
    gate.invalidate();
    const b = gate.begin();
    expect(firstA.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(true);
    gate.invalidate();
    const secondA = gate.begin();
    expect(firstA.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(false);
    expect(secondA.isCurrent()).toBe(true);
  });

  it("cleanup / Strict Mode : invalidate rend la génération précédente obsolète", () => {
    const gate = createPersonalSessionGate();
    const first = gate.begin();
    gate.invalidate();
    const second = gate.begin();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });
});

describe("isCarnetsLoadActive (branchement Home / frise)", () => {
  it("Home connecté : loadCarnets true active le chargement", () => {
    expect(
      isCarnetsLoadActive({
        loadCarnets: true,
        userId: "u1",
        isSessionPending: false,
      }),
    ).toBe(true);
  });

  it("frise hors vue Carnets : loadCarnets false n’active pas", () => {
    expect(
      isCarnetsLoadActive({
        loadCarnets: false,
        userId: "u1",
        isSessionPending: false,
      }),
    ).toBe(false);
  });

  it("session pending ou absente : pas de chargement", () => {
    expect(
      isCarnetsLoadActive({
        loadCarnets: true,
        userId: "u1",
        isSessionPending: true,
      }),
    ).toBe(false);
    expect(
      isCarnetsLoadActive({
        loadCarnets: true,
        userId: null,
        isSessionPending: false,
      }),
    ).toBe(false);
  });
});

describe("runFavoriteIdsLoad", () => {
  it("chargement tardif après ajout : fusionne serveur + ajout local", async () => {
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const delta = {
      added: new Set<string>(),
      removed: new Set<string>(),
    };
    const onMerged = vi.fn();

    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: () => true,
      getDelta: () => delta,
      onMerged,
    });

    delta.added.add("C");
    pending.resolve({ ok: true, eventIds: ["A", "B"] });
    await load;

    expect(onMerged).toHaveBeenCalledTimes(1);
    expect([...onMerged.mock.calls[0]![0]].sort()).toEqual(["A", "B", "C"]);
  });

  it("chargement tardif après retrait : ne réintroduit pas le favori", async () => {
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const delta = {
      added: new Set<string>(),
      removed: new Set<string>(["C"]),
    };
    const onMerged = vi.fn();

    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: () => true,
      getDelta: () => delta,
      onMerged,
    });

    pending.resolve({ ok: true, eventIds: ["A", "B", "C"] });
    await load;

    expect([...onMerged.mock.calls[0]![0]].sort()).toEqual(["A", "B"]);
  });

  it("erreur ok:false : n’appelle pas onMerged (pas d’effacement local)", async () => {
    const onMerged = vi.fn();
    await runFavoriteIdsLoad(
      async () => ({ ok: false, reason: "unauthenticated" }),
      {
        isCurrent: () => true,
        getDelta: () => ({ added: new Set(["C"]), removed: new Set() }),
        onMerged,
      },
    );
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("promesse rejetée : n’appelle pas onMerged", async () => {
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const onMerged = vi.fn();
    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: () => true,
      getDelta: () => ({ added: new Set(["C"]), removed: new Set() }),
      onMerged,
    });
    pending.reject(new Error("network"));
    await load;
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("session obsolète : ignore la réponse", async () => {
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const gate = createPersonalSessionGate();
    const session = gate.begin();
    const onMerged = vi.fn();

    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: session.isCurrent,
      getDelta: () => ({ added: new Set(), removed: new Set() }),
      onMerged,
    });

    gate.invalidate();
    pending.resolve({ ok: true, eventIds: ["stale"] });
    await load;
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("contenu favoris déjà chargé (autorité) : IDs tardifs ignorés", async () => {
    const pending = deferred<ListMyFavoriteEventIdsResult>();
    const authority = createFavoriteIdsAuthority();
    const auth = authority.capture();
    const onMerged = vi.fn();

    const load = runFavoriteIdsLoad(() => pending.promise, {
      isCurrent: () => auth.isAuthoritative(),
      getDelta: () => ({ added: new Set(), removed: new Set() }),
      onMerged,
    });

    // Contenu favoris / debug : bump d’autorité avant la réponse d’IDs.
    authority.bump();
    pending.resolve({ ok: true, eventIds: ["stale-from-ids"] });
    await load;

    expect(onMerged).not.toHaveBeenCalled();
  });
});

describe("runCarnetsLoad", () => {
  it("chargement tardif après retrait : filtre les appartenances locales", async () => {
    const pending = deferred<ListMyCarnetsStateResult>();
    const onMerged = vi.fn();
    const onServerSnapshot = vi.fn();

    const load = runCarnetsLoad(() => pending.promise, {
      isCurrent: () => true,
      getOverlay: () =>
        emptyOverlay({ excludedEventIds: new Set(["C"]) }),
      onServerSnapshot,
      onMerged,
    });

    pending.resolve({
      ok: true,
      groups: [group("g1", "G1")],
      memberships: [
        membership("A", "g1", "G1"),
        membership("C", "g1", "G1"),
      ],
    });
    await load;

    expect(onServerSnapshot).toHaveBeenCalledTimes(1);
    expect(onMerged).toHaveBeenCalledTimes(1);
    expect(
      onMerged.mock.calls[0]![0].memberships.map(
        (m: EventGroupMembership) => m.eventId,
      ),
    ).toEqual(["A"]);
  });

  it("modale crée G2+C pendant le load initial : fusionne avec G1/A/B du serveur", async () => {
    const pending = deferred<ListMyCarnetsStateResult>();
    const g2 = group("g2", "G2");
    const cToG2 = membership("C", "g2", "G2");
    const overlayGroups = new Map<string, GroupSummary>();
    const overlayMemberships = new Map<string, EventGroupMembership>();
    const onMerged = vi.fn();
    const onServerSnapshot = vi.fn();

    const load = runCarnetsLoad(() => pending.promise, {
      isCurrent: () => true,
      getOverlay: () =>
        emptyOverlay({
          upsertedGroups: overlayGroups,
          upsertedMemberships: overlayMemberships,
        }),
      onServerSnapshot,
      onMerged,
    });

    // Pendant le chargement : callbacks modale partiels (pas l’état serveur complet).
    overlayGroups.set("g2", g2);
    overlayMemberships.set(carnetMembershipKey("C", "g2"), cToG2);

    pending.resolve({
      ok: true,
      groups: [group("g1", "G1")],
      memberships: [
        membership("A", "g1", "G1"),
        membership("B", "g1", "G1"),
      ],
    });
    await load;

    const snapshot = onMerged.mock.calls[0]![0] as {
      groups: GroupSummary[];
      memberships: EventGroupMembership[];
    };
    expect(snapshot.groups.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect(
      snapshot.memberships.map((m) => `${m.eventId}→${m.groupId}`).sort(),
    ).toEqual(["A→g1", "B→g1", "C→g2"]);
    expect(
      Object.fromEntries(countCarnetsByEventId(snapshot.memberships)),
    ).toEqual({ A: 1, B: 1, C: 1 });
  });

  it("erreur de chargement : ne vide pas via onMerged ; onFailure + fin loading", async () => {
    const onMerged = vi.fn();
    const onFailure = vi.fn();
    const loading: boolean[] = [];
    await runCarnetsLoad(
      async () => ({ ok: false, reason: "unauthenticated" }),
      {
        isCurrent: () => true,
        getOverlay: () => emptyOverlay(),
        onServerSnapshot: vi.fn(),
        onMerged,
        onFailure,
        onLoading: (v) => loading.push(v),
      },
    );
    expect(onMerged).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(loading).toEqual([true, false]);
  });

  it("activation frise : hors isCarnetsLoadActive on ne démarre pas runCarnetsLoad", () => {
    const shouldStart = isCarnetsLoadActive({
      loadCarnets: false,
      userId: "u1",
      isSessionPending: false,
    });
    expect(shouldStart).toBe(false);
  });
});

describe("rollback ciblé (overlay favoris)", () => {
  it("échec d’ajout : retirer seulement l’id ajouté, sans marquer removed", () => {
    const overlay = {
      added: new Set(["C", "D"]),
      removed: new Set<string>(),
    };
    overlay.added.delete("C");
    const afterServer = mergeFavoriteIds(["A", "B"], overlay);
    expect([...afterServer].sort()).toEqual(["A", "B", "D"]);
    expect(overlay.removed.has("C")).toBe(false);
  });
});
