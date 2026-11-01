// @vitest-environment happy-dom

/**
 * Garde au rendu : corpus carnet non exposé si l’id ne correspond plus
 * à la sélection (fenêtre avant exécution des effets).
 */
import { describe, expect, it, vi } from "vitest";
import { act, useState, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { GetMyCarnetEventsResult } from "@/app/actions/groups";
import type { EventItem } from "@/data/types";
import { flushMicrotasks } from "@/components/personal/render-hook";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
      data: { user: { id: "user-a", name: "A", email: "a@example.com" } },
      isPending: false,
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

describe("useFrisePersonalData monté — garde au rendu A→B", () => {
  it("premier rendu avec B : n’expose plus les événements/nom de A (avant effets)", async () => {
    const pendingB = deferred<GetMyCarnetEventsResult>();

    // Référence stable — évite une boucle d’effet via la dep getCarnetEvents.
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

    // Premier snapshot avec B sélectionné — avant / indépendamment du clear d’effet.
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
    delete (globalThis as unknown as { __friseSeen?: Snapshot[] }).__friseSeen;
  });
});
