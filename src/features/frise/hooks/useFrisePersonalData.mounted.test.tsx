// @vitest-environment happy-dom

/**
 * Gardes au rendu : corpus carnet (sélection) + isolation de compte (session).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, useState, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { ListMyFavoriteEventsResult } from "@/app/actions/favorites";
import type { GetMyCarnetEventsResult } from "@/app/actions/groups";
import type { EventItem } from "@/data/types";
import { flushMicrotasks } from "@/components/personal/render-hook";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type MockSession = {
  user: { id: string; name: string; email: string };
} | null;

const sessionState: { data: MockSession; isPending: boolean } = {
  data: { user: { id: "user-a", name: "A", email: "a@example.com" } },
  isPending: false,
};

vi.mock("@/app/actions/favorites", () => ({
  listMyFavoriteEventIds: vi.fn(async () => ({ ok: true, eventIds: [] })),
  listMyFavoriteEvents: vi.fn(async () => ({ ok: true, events: [] })),
}));

vi.mock("@/app/actions/groups", () => ({
  listMyCarnetsState: vi.fn(async () => ({
    ok: true,
    groups: [],
    memberships: [],
  })),
  getMyCarnetEvents: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: sessionState.data,
      isPending: sessionState.isPending,
    }),
  },
}));

import { useFrisePersonalData } from "@/features/frise/hooks/useFrisePersonalData";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setSession(userId: string | null) {
  sessionState.data = userId
    ? { user: { id: userId, name: userId, email: `${userId}@example.com` } }
    : null;
  sessionState.isPending = false;
}

beforeEach(() => {
  setSession("user-a");
  delete (globalThis as unknown as { __friseSeen?: unknown }).__friseSeen;
  delete (globalThis as unknown as { __frisePd?: unknown }).__frisePd;
});

describe("useFrisePersonalData monté — garde au rendu carnet A→B", () => {
  it("premier rendu avec B : n’expose plus les événements/nom de A (avant effets)", async () => {
    const pendingB = deferred<GetMyCarnetEventsResult>();

    const getCarnetEvents = (id: string): Promise<GetMyCarnetEventsResult> => {
      if (id === "carnet-a") {
        return Promise.resolve({
          ok: true,
          group: { id: "carnet-a", name: "Carnet A" },
          events: [event("a1")],
        });
      }
      return pendingB.promise;
    };

    type Snapshot = {
      notebookId: string | null;
      eventIds: string[];
      name: string | null;
    };

    function Harness() {
      const [notebookId, setNotebookId] = useState<string | null>("carnet-a");
      const personal = useFrisePersonalData({
        view: "notebook",
        notebookId,
        getCarnetEvents,
      });

      const seen =
        ((globalThis as unknown as { __friseSeen?: Snapshot[] }).__friseSeen ??=
          []);
      seen.push({
        notebookId,
        eventIds: personal.notebookEvents.map((item) => item.id),
        name: personal.notebookName,
      });

      (globalThis as unknown as { __frisePd: unknown }).__frisePd = {
        personal,
        setNotebookId,
        seen,
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
      personal: ReturnType<typeof useFrisePersonalData>;
      setNotebookId: (id: string | null) => void;
      seen: Snapshot[];
    };
    const getPd = () =>
      (globalThis as unknown as { __frisePd: Pd }).__frisePd;

    expect(getPd().personal.notebookEvents.map((e) => e.id)).toEqual(["a1"]);
    expect(getPd().personal.notebookName).toBe("Carnet A");

    const beforeSwitch = getPd().seen.length;

    act(() => {
      getPd().setNotebookId("carnet-b");
    });

    const firstWithB = getPd().seen
      .slice(beforeSwitch)
      .find((snap) => snap.notebookId === "carnet-b");
    expect(firstWithB).toEqual({
      notebookId: "carnet-b",
      eventIds: [],
      name: null,
    });

    pendingB.resolve({ ok: false, reason: "error" });
    await flushMicrotasks();

    expect(getPd().personal.notebookEvents).toEqual([]);
    expect(getPd().personal.notebookName).toBeNull();
    expect(getPd().personal.notebookError).toBe(
      "Impossible de charger ce carnet.",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("useFrisePersonalData monté — isolation de compte", () => {
  it("compte A → B : aucune donnée de A dès le premier rendu", async () => {
    const listFavoriteEvents = (): Promise<ListMyFavoriteEventsResult> => {
      const id = sessionState.data?.user.id;
      if (id === "user-a") {
        return Promise.resolve({ ok: true, events: [event("fav-a")] });
      }
      return Promise.resolve({ ok: true, events: [event("fav-b")] });
    };

    type Snapshot = {
      userId: string | null;
      eventIds: string[];
      error: string | null;
    };

    function Harness() {
      const [, bump] = useState(0);
      const personal = useFrisePersonalData({
        view: "favorites",
        notebookId: null,
        listFavoriteEvents,
      });

      const seen =
        ((globalThis as unknown as { __friseSeen?: Snapshot[] }).__friseSeen ??=
          []);
      seen.push({
        userId: sessionState.data?.user.id ?? null,
        eventIds: personal.favoriteEvents.map((item) => item.id),
        error: personal.favoriteEventsError,
      });

      (globalThis as unknown as { __frisePd: unknown }).__frisePd = {
        personal,
        rerender: () => bump((n) => n + 1),
        seen,
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
      personal: ReturnType<typeof useFrisePersonalData>;
      rerender: () => void;
      seen: Snapshot[];
    };
    const getPd = () =>
      (globalThis as unknown as { __frisePd: Pd }).__frisePd;

    expect(getPd().personal.favoriteEvents.map((e) => e.id)).toEqual([
      "fav-a",
    ]);

    const beforeSwitch = getPd().seen.length;
    setSession("user-b");
    act(() => {
      getPd().rerender();
    });

    const firstWithB = getPd().seen
      .slice(beforeSwitch)
      .find((snap) => snap.userId === "user-b");
    expect(firstWithB).toEqual({
      userId: "user-b",
      eventIds: [],
      error: null,
    });

    await flushMicrotasks();
    expect(getPd().personal.favoriteEvents.map((e) => e.id)).toEqual([
      "fav-b",
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("compte A → B + échec réseau : aucune donnée de A visible", async () => {
    const pendingB = deferred<ListMyFavoriteEventsResult>();
    const listFavoriteEvents = (): Promise<ListMyFavoriteEventsResult> => {
      if (sessionState.data?.user.id === "user-a") {
        return Promise.resolve({ ok: true, events: [event("fav-a")] });
      }
      return pendingB.promise;
    };

    function Harness() {
      const [, bump] = useState(0);
      const personal = useFrisePersonalData({
        view: "favorites",
        notebookId: null,
        listFavoriteEvents,
      });
      (globalThis as unknown as { __frisePd: unknown }).__frisePd = {
        personal,
        rerender: () => bump((n) => n + 1),
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
      personal: ReturnType<typeof useFrisePersonalData>;
      rerender: () => void;
    };
    const getPd = () =>
      (globalThis as unknown as { __frisePd: Pd }).__frisePd;

    setSession("user-b");
    act(() => {
      getPd().rerender();
    });
    expect(getPd().personal.favoriteEvents).toEqual([]);

    pendingB.resolve({ ok: false, reason: "error" });
    await flushMicrotasks();

    expect(getPd().personal.favoriteEvents).toEqual([]);
    expect(getPd().personal.favoriteEventsError).toBe(
      "Impossible de charger vos favoris.",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("compte A → déconnexion : données personnelles immédiatement masquées", async () => {
    const listFavoriteEvents = async (): Promise<ListMyFavoriteEventsResult> => ({
      ok: true,
      events: [event("fav-a")],
    });

    function Harness() {
      const [, bump] = useState(0);
      const personal = useFrisePersonalData({
        view: "favorites",
        notebookId: null,
        listFavoriteEvents,
      });
      (globalThis as unknown as { __frisePd: unknown }).__frisePd = {
        personal,
        rerender: () => bump((n) => n + 1),
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
      personal: ReturnType<typeof useFrisePersonalData>;
      rerender: () => void;
    };
    const getPd = () =>
      (globalThis as unknown as { __frisePd: Pd }).__frisePd;

    expect(getPd().personal.favoriteEvents.map((e) => e.id)).toEqual([
      "fav-a",
    ]);

    setSession(null);
    act(() => {
      getPd().rerender();
    });

    expect(getPd().personal.favoriteEvents).toEqual([]);
    expect(getPd().personal.favoriteEventsError).toBeNull();
    expect(getPd().personal.favoriteEventsLoading).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("A → B → A : réponse tardive de l’ancienne session A ignorée", async () => {
    const pendingA1 = deferred<ListMyFavoriteEventsResult>();
    const pendingB = deferred<ListMyFavoriteEventsResult>();
    const pendingA2 = deferred<ListMyFavoriteEventsResult>();
    let loadIndex = 0;

    const listFavoriteEvents = (): Promise<ListMyFavoriteEventsResult> => {
      loadIndex += 1;
      if (loadIndex === 1) return pendingA1.promise;
      if (loadIndex === 2) return pendingB.promise;
      return pendingA2.promise;
    };

    function Harness() {
      const [, bump] = useState(0);
      const personal = useFrisePersonalData({
        view: "favorites",
        notebookId: null,
        listFavoriteEvents,
      });
      (globalThis as unknown as { __frisePd: unknown }).__frisePd = {
        personal,
        rerender: () => bump((n) => n + 1),
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
      personal: ReturnType<typeof useFrisePersonalData>;
      rerender: () => void;
    };
    const getPd = () =>
      (globalThis as unknown as { __frisePd: Pd }).__frisePd;

    setSession("user-b");
    act(() => {
      getPd().rerender();
    });
    await flushMicrotasks();

    setSession("user-a");
    act(() => {
      getPd().rerender();
    });
    await flushMicrotasks();

    pendingB.resolve({ ok: true, events: [event("stale-b")] });
    pendingA1.resolve({ ok: true, events: [event("stale-a1")] });
    pendingA2.resolve({ ok: true, events: [event("fresh-a2")] });
    await flushMicrotasks();

    expect(getPd().personal.favoriteEvents.map((e) => e.id)).toEqual([
      "fresh-a2",
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("retry échoué même compte : conserve le corpus favoris valide", async () => {
    let calls = 0;
    const listFavoriteEvents = async (): Promise<ListMyFavoriteEventsResult> => {
      calls += 1;
      if (calls === 1) {
        return { ok: true, events: [event("fav-a")] };
      }
      return { ok: false, reason: "error" };
    };

    function Harness() {
      const [, bump] = useState(0);
      const personal = useFrisePersonalData({
        view: "favorites",
        notebookId: null,
        listFavoriteEvents,
      });
      (globalThis as unknown as { __frisePd: unknown }).__frisePd = {
        personal,
        rerender: () => bump((n) => n + 1),
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

    type Pd = { personal: ReturnType<typeof useFrisePersonalData> };
    const getPd = () =>
      (globalThis as unknown as { __frisePd: Pd }).__frisePd;

    expect(getPd().personal.favoriteEvents.map((e) => e.id)).toEqual([
      "fav-a",
    ]);

    act(() => {
      getPd().personal.retryFavoriteEvents();
    });
    await flushMicrotasks();

    expect(getPd().personal.favoriteEvents.map((e) => e.id)).toEqual([
      "fav-a",
    ]);
    expect(getPd().personal.favoriteEventsError).toBe(
      "Impossible de charger vos favoris.",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
