import {
  isValidElement,
  type DependencyList,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventItem } from "@/data/types";

const hookRuntime = vi.hoisted(() => {
  const states: unknown[] = [];
  const effectDependencies: Array<DependencyList | undefined> = [];
  let cursor = 0;
  let dirty = false;
  let pendingEffects: Array<() => void | (() => void)> = [];

  return {
    reset() {
      states.length = 0;
      effectDependencies.length = 0;
      cursor = 0;
      dirty = false;
      pendingEffects = [];
    },
    beginRender() {
      cursor = 0;
      pendingEffects = [];
    },
    useState<T>(initial: T | (() => T)) {
      const index = cursor++;
      if (!(index in states)) {
        states[index] =
          typeof initial === "function"
            ? (initial as () => T)()
            : initial;
      }
      const setState = (next: T | ((current: T) => T)) => {
        const current = states[index] as T;
        states[index] =
          typeof next === "function"
            ? (next as (value: T) => T)(current)
            : next;
        dirty = true;
      };
      return [states[index] as T, setState] as const;
    },
    useEffect(effect: () => void | (() => void), dependencies?: DependencyList) {
      const index = cursor++;
      const previous = effectDependencies[index];
      const changed =
        dependencies == null ||
        previous == null ||
        dependencies.length !== previous.length ||
        dependencies.some((value, dependencyIndex) => {
          return !Object.is(value, previous[dependencyIndex]);
        });
      effectDependencies[index] = dependencies;
      if (changed) pendingEffects.push(effect);
    },
    useMemo<T>(factory: () => T) {
      cursor++;
      return factory();
    },
    useCallback<T extends (...args: never[]) => unknown>(callback: T) {
      cursor++;
      return callback;
    },
    useTransition() {
      cursor++;
      return [
        false,
        (callback: () => void | Promise<void>) => {
          void callback();
        },
      ] as const;
    },
    flushEffects() {
      const effects = pendingEffects;
      pendingEffects = [];
      effects.forEach((effect) => effect());
    },
    consumeDirty() {
      const current = dirty;
      dirty = false;
      return current;
    },
  };
});

const actions = vi.hoisted(() => ({
  addFavorite: vi.fn(),
  listMyFavoriteEventIds: vi.fn(),
  listMyFavoriteEvents: vi.fn(),
  removeFavorite: vi.fn(),
}));

const router = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useCallback: hookRuntime.useCallback,
    useEffect: hookRuntime.useEffect,
    useMemo: hookRuntime.useMemo,
    useState: hookRuntime.useState,
    useTransition: hookRuntime.useTransition,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: "a",
}));

vi.mock("@/app/actions/favorites", () => actions);
vi.mock("@/app/actions/groups", () => ({
  getMyCarnetEvents: vi.fn(),
  listMyCarnetsState: vi.fn(),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => null,
}));
vi.mock("@/features/account/components/PendingFavoriteAfterAuthGate", () => ({
  PendingFavoriteAfterAuthGate: () => null,
}));
vi.mock("@/components/event/EventDetailModal", () => ({
  EventDetailModal: () => null,
}));
vi.mock("@/features/home/components/explorer/CategoryFilter", () => ({
  CategoryFilter: () => null,
}));
vi.mock("@/features/frise/components/FriseEmptyState", () => ({
  FriseEmptyState: () => null,
}));
vi.mock("@/features/frise/components/FriseCarnetThumbs", () => ({
  FriseCarnetThumbs: () => null,
}));
vi.mock("@/features/frise/components/FriseViewNav", () => ({
  FriseViewNav: () => null,
}));

vi.mock("@/features/frise/hooks/useFriseEvents", () => ({
  useFriseEvents: () => ({
    model: { coverageStatus: "complete", eventCountInWindow: 0 },
    totalCount: 0,
    emptyKind: "collection_empty",
    loading: false,
    error: null,
    canPrev: false,
    canNext: false,
    goToday: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock("@/features/frise/hooks/useFrisePersonalEvents", () => ({
  useFrisePersonalEvents: ({
    sourceEvents,
  }: {
    sourceEvents: EventItem[];
  }) => ({
    model: {
      coverageStatus: "complete",
      eventCountInWindow: sourceEvents.length,
      eventIds: sourceEvents.map((event) => event.id),
    },
    totalCount: sourceEvents.length,
    emptyKind: sourceEvents.length === 0 ? "collection_empty" : "none",
    loading: false,
    error: null,
    canPrev: false,
    canNext: false,
    goToday: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
  }),
}));

function MockFriseRideTrack() {
  return null;
}

vi.mock("@/features/frise/components/FriseRideTrack", () => ({
  FriseRideTrack: MockFriseRideTrack,
}));

import { FrisePageClient } from "@/features/frise/components/FrisePageClient";

function event(id: string, title: string): EventItem {
  return {
    id,
    title,
    category: "Musique",
    genre: "Concert",
    venue: "L’Astrolabe",
    city: "Orléans",
    date: "2026-10-12",
    dateLabel: "Lundi 12 octobre",
    startAt: "2026-10-12T20:00:00+02:00",
  };
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (predicate(node)) return node;
  return findElement(node.props.children as ReactNode, predicate);
}

describe("FrisePageClient — rollback des favoris", () => {
  beforeEach(() => {
    hookRuntime.reset();
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      location: { search: "" },
    });
  });

  it("restaure la carte sans écraser un favori arrivé pendant la requête", async () => {
    const first = event("event-1", "Premier concert");
    const second = event("event-2", "Deuxième concert");
    const third = event("event-3", "Troisième concert");
    let resolveRemoval:
      | ((value: { ok: false; reason: "error" }) => void)
      | undefined;

    actions.listMyFavoriteEventIds.mockResolvedValue({
      ok: true,
      eventIds: [first.id, second.id],
    });
    actions.listMyFavoriteEvents
      .mockResolvedValueOnce({
        ok: true,
        events: [first, second],
      })
      .mockResolvedValueOnce({
        ok: true,
        events: [second, third],
      });
    actions.removeFavorite.mockReturnValue(
      new Promise((resolve) => {
        resolveRemoval = resolve;
      }),
    );

    let tree: ReactNode = null;
    const render = () => {
      hookRuntime.beginRender();
      tree = FrisePageClient({
        initialView: "favorites",
        initialCategory: "tout",
        initialNotebookId: null,
      });
      hookRuntime.flushEffects();
    };
    const flush = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await Promise.resolve();
        if (!hookRuntime.consumeDirty()) continue;
        render();
      }
    };
    const track = () => {
      const element = findElement(
        tree,
        (candidate) => candidate.type === MockFriseRideTrack,
      );
      if (!element) throw new Error("La frise devrait être rendue.");
      return element;
    };
    const navigation = () => {
      const element = findElement(tree, (candidate) => {
        return (
          candidate.props.value != null &&
          typeof candidate.props.onChange === "function"
        );
      });
      if (!element) throw new Error("La navigation devrait être rendue.");
      return element;
    };

    render();
    await flush();

    expect(
      (track().props.model as { eventIds: string[] }).eventIds,
    ).toEqual([first.id, second.id]);
    expect(track().props.favorites as Set<string>).toEqual(
      new Set([first.id, second.id]),
    );

    (
      track().props.onToggleFavorite as (eventId: string) => void
    )(first.id);
    expect(actions.removeFavorite).toHaveBeenCalledWith(first.id);

    render();
    expect(
      (track().props.model as { eventIds: string[] }).eventIds,
    ).toEqual([second.id]);
    expect(track().props.favorites as Set<string>).toEqual(
      new Set([second.id]),
    );

    (
      navigation().props.onChange as (view: "all" | "favorites") => void
    )("all");
    render();
    (
      navigation().props.onChange as (view: "all" | "favorites") => void
    )("favorites");
    render();
    await flush();

    expect(
      (track().props.model as { eventIds: string[] }).eventIds,
    ).toEqual([second.id, third.id]);
    expect(track().props.favorites as Set<string>).toEqual(
      new Set([second.id, third.id]),
    );

    resolveRemoval?.({ ok: false, reason: "error" });
    await flush();

    expect(
      (track().props.model as { eventIds: string[] }).eventIds,
    ).toEqual([first.id, second.id, third.id]);
    expect(track().props.favorites as Set<string>).toEqual(
      new Set([first.id, second.id, third.id]),
    );
    expect(track().props.bannerError).toBe(
      "Impossible d’enregistrer ce détour. Réessayez.",
    );
  });
});
