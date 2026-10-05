// @vitest-environment happy-dom

/**
 * Régressions sur le hook monté (pas seulement les helpers).
 * Environnement : `// @vitest-environment happy-dom` en tête de fichier.
 */
import { describe, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { ListMyFavoriteEventIdsResult } from "@/app/actions/favorites";
import type { ListMyCarnetsStateResult } from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import {
  flushMicrotasks,
  renderHook,
} from "@/components/personal/render-hook";
import { usePersonalData } from "@/components/personal/usePersonalData";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/app/actions/favorites", () => ({
  listMyFavoriteEventIds: vi.fn(),
}));

vi.mock("@/app/actions/groups", () => ({
  listMyCarnetsState: vi.fn(),
}));

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

describe("usePersonalData monté — appartenance décochée", () => {
  it("retire A→G1 sans toucher B→G1 ; résiste au snapshot initial tardif", async () => {
    const pendingCarnets = deferred<ListMyCarnetsStateResult>();
    const listFavoriteIds = vi.fn(async () => ({
      ok: true as const,
      eventIds: ["A", "B"],
    }));
    const listCarnets = vi.fn(() => pendingCarnets.promise);

    const { result, unmount } = renderHook(() =>
      usePersonalData({
        userId: "user-a",
        isSessionPending: false,
        loadCarnets: true,
        listFavoriteIds,
        listCarnets,
      }),
    );

    await flushMicrotasks();

    act(() => {
      // Pendant le load : décocher A de G1 (payload peut contenir d’autres events).
      result.current.replaceMemberships(
        ["A"],
        [
          membership("B", "g1", "G1"), // hors scope — ne doit pas tout remplacer
        ],
      );
    });

    expect(
      result.current.memberships.map((m) => `${m.eventId}→${m.groupId}`),
    ).toEqual([]);
    // Pas encore de serveur : rien à retirer d’un snapshot vide.
    // Injectons le serveur tardif avec A et B.
    pendingCarnets.resolve({
      ok: true,
      groups: [group("g1", "G1")],
      memberships: [
        membership("A", "g1", "G1"),
        membership("B", "g1", "G1"),
      ],
    });
    await flushMicrotasks();

    expect(
      result.current.memberships.map((m) => `${m.eventId}→${m.groupId}`).sort(),
    ).toEqual(["B→g1"]);
    expect(Object.fromEntries(result.current.carnetCounts)).toEqual({ B: 1 });

    unmount();
  });

  it("conserve G1/G2 + trois appartenances après création locale puis load tardif", async () => {
    const pendingCarnets = deferred<ListMyCarnetsStateResult>();
    const { result, unmount } = renderHook(() =>
      usePersonalData({
        userId: "user-a",
        isSessionPending: false,
        loadCarnets: true,
        listFavoriteIds: async () => ({ ok: true, eventIds: [] }),
        listCarnets: () => pendingCarnets.promise,
      }),
    );

    await flushMicrotasks();

    const g2 = group("g2", "G2");
    act(() => {
      result.current.replaceGroups([g2]);
      result.current.replaceMemberships(["C"], [membership("C", "g2", "G2")]);
    });

    pendingCarnets.resolve({
      ok: true,
      groups: [group("g1", "G1")],
      memberships: [
        membership("A", "g1", "G1"),
        membership("B", "g1", "G1"),
      ],
    });
    await flushMicrotasks();

    expect(result.current.groups.map((g) => g.id).sort()).toEqual([
      "g1",
      "g2",
    ]);
    expect(
      result.current.memberships
        .map((m) => `${m.eventId}→${m.groupId}`)
        .sort(),
    ).toEqual(["A→g1", "B→g1", "C→g2"]);

    unmount();
  });
});

describe("usePersonalData monté — erreur de chargement carnets", () => {
  it("conserve G2 + C→G2 si le load retourne ok:false", async () => {
    const pendingCarnets = deferred<ListMyCarnetsStateResult>();
    const { result, unmount } = renderHook(() =>
      usePersonalData({
        userId: "user-a",
        isSessionPending: false,
        loadCarnets: true,
        listFavoriteIds: async () => ({ ok: true, eventIds: [] }),
        listCarnets: () => pendingCarnets.promise,
      }),
    );

    await flushMicrotasks();

    act(() => {
      result.current.replaceGroups([group("g2", "G2")]);
      result.current.replaceMemberships(["C"], [membership("C", "g2", "G2")]);
    });

    expect(result.current.groups.map((g) => g.id)).toEqual(["g2"]);
    expect(
      result.current.memberships.map((m) => `${m.eventId}→${m.groupId}`),
    ).toEqual(["C→g2"]);

    pendingCarnets.resolve({ ok: false, reason: "error" });
    await flushMicrotasks();

    expect(result.current.groups.map((g) => g.id)).toEqual(["g2"]);
    expect(
      result.current.memberships.map((m) => `${m.eventId}→${m.groupId}`),
    ).toEqual(["C→g2"]);
    expect(Object.fromEntries(result.current.carnetCounts)).toEqual({ C: 1 });
    expect(result.current.carnetsLoading).toBe(false);

    unmount();
  });
});

describe("usePersonalData monté — session A→B→A et isolation rendu", () => {
  it("un ancien rollback de A1 ne modifie pas le nouvel état A2", async () => {
    const favoritesByUser: Record<string, string[]> = {
      "user-a": ["keep-a"],
      "user-b": ["keep-b"],
    };

    function Harness() {
      const [userId, setUserId] = useState<string | null>("user-a");
      const personal = usePersonalData({
        userId,
        isSessionPending: false,
        loadCarnets: false,
        listFavoriteIds: async () => ({
          ok: true,
          eventIds: favoritesByUser[userId ?? ""] ?? [],
        }),
        listCarnets: async () => ({
          ok: true,
          groups: [],
          memberships: [],
        }),
      });

      (globalThis as unknown as { __pd: unknown }).__pd = {
        personal,
        setUserId,
      };
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(Harness));
    });
    await flushMicrotasks();

    type Pd = {
      personal: ReturnType<typeof usePersonalData>;
      setUserId: (id: string | null) => void;
    };
    const getPd = () =>
      (globalThis as unknown as { __pd: Pd }).__pd;

    act(() => {
      getPd().personal.addFavoriteLocally("temp");
    });
    const staleRollback = getPd().personal.rollbackFavoriteAdd;

    act(() => {
      getPd().setUserId("user-b");
    });
    await flushMicrotasks();

    act(() => {
      getPd().setUserId("user-a");
    });
    await flushMicrotasks();

    expect([...getPd().personal.favorites].sort()).toEqual(["keep-a"]);

    act(() => {
      staleRollback("keep-a");
      staleRollback("temp");
    });

    expect([...getPd().personal.favorites].sort()).toEqual(["keep-a"]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("un ancien replaceMemberships de A1 ne modifie pas A2", async () => {
    function Harness() {
      const [userId, setUserId] = useState<string | null>("user-a");
      const personal = usePersonalData({
        userId,
        isSessionPending: false,
        loadCarnets: true,
        listFavoriteIds: async () => ({ ok: true, eventIds: [] }),
        listCarnets: async () => ({
          ok: true,
          groups: [group("g1", "G1")],
          memberships: [
            membership("A", "g1", "G1"),
            membership("B", "g1", "G1"),
          ],
        }),
      });
      (globalThis as unknown as { __pd: unknown }).__pd = {
        personal,
        setUserId,
      };
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(Harness));
    });
    await flushMicrotasks();

    type Pd = {
      personal: ReturnType<typeof usePersonalData>;
      setUserId: (id: string | null) => void;
    };
    const getPd = () =>
      (globalThis as unknown as { __pd: Pd }).__pd;

    const staleReplace = getPd().personal.replaceMemberships;

    act(() => {
      getPd().setUserId("user-b");
    });
    await flushMicrotasks();
    act(() => {
      getPd().setUserId("user-a");
    });
    await flushMicrotasks();

    expect(
      getPd()
        .personal.memberships.map((m) => `${m.eventId}→${m.groupId}`)
        .sort(),
    ).toEqual(["A→g1", "B→g1"]);

    act(() => {
      staleReplace(["A"], []);
    });

    expect(
      getPd()
        .personal.memberships.map((m) => `${m.eventId}→${m.groupId}`)
        .sort(),
    ).toEqual(["A→g1", "B→g1"]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("premier rendu de B n’expose pas les favoris de A", async () => {
    const pendingA = deferred<ListMyFavoriteEventIdsResult>();
    const pendingB = deferred<ListMyFavoriteEventIdsResult>();

    function Harness() {
      const [userId, setUserId] = useState<string | null>("user-a");
      const personal = usePersonalData({
        userId,
        isSessionPending: false,
        loadCarnets: false,
        listFavoriteIds: () =>
          userId === "user-a" ? pendingA.promise : pendingB.promise,
      });
      (globalThis as unknown as { __pd: unknown }).__pd = {
        personal,
        setUserId,
        seen: [
          ...((globalThis as unknown as { __pd?: { seen?: string[][] } }).__pd
            ?.seen ?? []),
          [...personal.favorites],
        ],
      };
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(Harness));
    });

    pendingA.resolve({ ok: true, eventIds: ["fav-a"] });
    await flushMicrotasks();

    type Pd = {
      personal: ReturnType<typeof usePersonalData>;
      setUserId: (id: string | null) => void;
      seen: string[][];
    };
    const getPd = () =>
      (globalThis as unknown as { __pd: Pd }).__pd;

    expect([...getPd().personal.favorites]).toEqual(["fav-a"]);

    act(() => {
      getPd().setUserId("user-b");
    });

    // Immédiatement après le rendu de B : pas les favoris de A.
    expect([...getPd().personal.favorites]).toEqual([]);

    pendingB.resolve({ ok: true, eventIds: ["fav-b"] });
    await flushMicrotasks();
    expect([...getPd().personal.favorites]).toEqual(["fav-b"]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
