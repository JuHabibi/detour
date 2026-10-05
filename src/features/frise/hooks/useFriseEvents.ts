"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadExplorerEvents } from "@/app/actions/load-explorer-events";
import type { LoadExplorerEventsResult } from "@/app/actions/load-explorer-events";
import {
  categoryIdToExplorerFilter,
  cityToExplorerFilter,
} from "@/application/explorer/explorer-public-query";
import {
  EXPLORER_FRIEZE_HARD_CAP,
  EXPLORER_FRIEZE_PAGE_SIZE,
  buildExplorerFrieze,
  parisMonthStartKey,
  resolveFriseCoverageStatus,
  resolveFriezeWindow,
  shiftFriezeAnchor,
  type ExplorerFriezeModel,
  type FriseCoverageStatus,
  type FriseSettledScope,
} from "@/features/frise/timeline/frise-timeline-model";
import type { CategoryId, EventItem } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";

type UseFriseEventsParams = {
  /** Catégorie produit — `"tout"` = pas de filtre Explorer. */
  category: CategoryId;
  city: V1Commune | null;
  search: string;
  enabled: boolean;
  load?: typeof loadExplorerEvents;
};

export type FriseEventsLoadSuccess = {
  events: EventItem[];
  fetchedCount: number;
  truncatedByCap: boolean;
  totalCount: number;
};

/** Tranche d’état qui détermine `model.coverageStatus` exposé par le hook. */
export type FriseEventsExposedSlice = {
  settled: FriseSettledScope | null;
  error: string | null;
};

export type FriseReloadScope = {
  from: string;
  to: string;
  category: string;
  city: string | null;
  search: string;
};

/** Démarrage de reload / retry : coverage → pending immédiatement. */
export function friseEventsReloadStart(): FriseEventsExposedSlice {
  return { settled: null, error: null };
}

export function friseEventsReloadSuccess(
  scope: FriseReloadScope,
  truncatedByCap: boolean,
): FriseEventsExposedSlice {
  return {
    error: null,
    settled: {
      ...scope,
      status: truncatedByCap ? "truncated" : "complete",
    },
  };
}

export function friseEventsReloadFailure(
  scope: FriseReloadScope,
  message: string,
): FriseEventsExposedSlice {
  return {
    error: message,
    settled: { ...scope, status: "error" },
  };
}

/** Coverage effectivement exposée via `model.coverageStatus`. */
export function exposedFriseCoverageStatus(
  view: FriseReloadScope,
  slice: FriseEventsExposedSlice,
): FriseCoverageStatus {
  return resolveFriseCoverageStatus({
    viewFrom: view.from,
    viewTo: view.to,
    viewCategory: view.category,
    viewCity: view.city,
    viewSearch: view.search,
    settled: slice.settled,
  });
}

type FriseEventsLoadHandlers = {
  /** false → ne plus toucher l’UI (requête obsolète). */
  isCurrent: () => boolean;
  onLoading: (loading: boolean) => void;
  onSuccess: (data: FriseEventsLoadSuccess) => void;
  onError: (error: string) => void;
};

/**
 * Charge les pages frise pour une fenêtre civile. N’applique loading /
 * succès / erreur que tant que `isCurrent()` reste vrai.
 */
export async function runFriseEventsReload(
  params: {
    category: CategoryId;
    city: V1Commune | null;
    search: string;
    /** Début inclus `YYYY-MM-DD` (fenêtre affichée). */
    from: string;
    /** Fin inclusive `YYYY-MM-DD` (fenêtre affichée). */
    to: string;
    load: typeof loadExplorerEvents;
  },
  handlers: FriseEventsLoadHandlers,
): Promise<void> {
  const { isCurrent, onLoading, onSuccess, onError } = handlers;
  if (!isCurrent()) return;

  onLoading(true);

  try {
    const collected: EventItem[] = [];
    let cursor: string | null = null;
    let totalCount: number | null = null;
    let truncated = false;

    while (collected.length < EXPLORER_FRIEZE_HARD_CAP) {
      if (!isCurrent()) return;

      const result: LoadExplorerEventsResult = await params.load({
        when: "upcoming",
        category: categoryIdToExplorerFilter(params.category) ?? null,
        city: cityToExplorerFilter(params.city) ?? null,
        search: params.search || null,
        from: params.from,
        to: params.to,
        cursor,
        limit: EXPLORER_FRIEZE_PAGE_SIZE,
      });

      if (!isCurrent()) return;

      if (!result.ok) {
        onError(result.error);
        return;
      }

      if (cursor === null) {
        if (typeof result.totalCount !== "number") {
          onError("Impossible de charger mon parcours culturel.");
          return;
        }
        totalCount = result.totalCount;
      }

      collected.push(...result.events);

      if (!result.nextCursor) break;
      if (collected.length >= EXPLORER_FRIEZE_HARD_CAP) {
        truncated = true;
        break;
      }
      cursor = result.nextCursor;
    }

    if (!isCurrent()) return;

    if (typeof totalCount !== "number") {
      onError("Impossible de charger mon parcours culturel.");
      return;
    }

    onSuccess({
      events: collected.slice(0, EXPLORER_FRIEZE_HARD_CAP),
      fetchedCount: Math.min(collected.length, EXPLORER_FRIEZE_HARD_CAP),
      truncatedByCap: truncated,
      totalCount,
    });
  } catch {
    if (!isCurrent()) return;
    onError("Impossible de charger mon parcours culturel.");
  } finally {
    if (isCurrent()) onLoading(false);
  }
}

export function useFriseEvents({
  category,
  city,
  search,
  enabled,
  load = loadExplorerEvents,
}: UseFriseEventsParams) {
  const [anchorMonth, setAnchorMonth] = useState(() => parisMonthStartKey());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<FriseSettledScope | null>(null);
  const loadGenerationRef = useRef(0);

  const window = resolveFriezeWindow(anchorMonth);
  const coverageStatus = resolveFriseCoverageStatus({
    viewFrom: window.fromKey,
    viewTo: window.toKey,
    viewCategory: category,
    viewCity: city,
    viewSearch: search,
    settled,
  });
  const dataMatchesView = coverageStatus !== "pending";

  const model: ExplorerFriezeModel = buildExplorerFrieze({
    events: dataMatchesView && coverageStatus !== "error" ? events : [],
    window,
    fetchedCount: dataMatchesView ? fetchedCount : 0,
    truncatedByCap: coverageStatus === "truncated",
    coverageStatus,
  });

  const reload = useCallback(async () => {
    if (!enabled) return;

    const loadId = ++loadGenerationRef.current;
    const isCurrent = () => loadId === loadGenerationRef.current;
    const requestFrom = window.fromKey;
    const requestTo = window.toKey;
    const requestCategory = category;
    const requestCity = city;
    const requestSearch = search;

    // Retry / refetch fenêtre courante : coverage → pending avant le fetch
    // (évite de rester sur error/complete pendant le rechargement).
    const reloadStart = friseEventsReloadStart();
    setError(reloadStart.error);
    setSettled(reloadStart.settled);

    await runFriseEventsReload(
      {
        category,
        city,
        search,
        from: requestFrom,
        to: requestTo,
        load,
      },
      {
        isCurrent,
        onLoading: setLoading,
        onSuccess: (data) => {
          setEvents(data.events);
          setFetchedCount(data.fetchedCount);
          setTotalCount(data.totalCount);
          const next = friseEventsReloadSuccess(
            {
              from: requestFrom,
              to: requestTo,
              category: requestCategory,
              city: requestCity,
              search: requestSearch,
            },
            data.truncatedByCap,
          );
          setError(next.error);
          setSettled(next.settled);
        },
        onError: (message) => {
          setEvents([]);
          setFetchedCount(0);
          setTotalCount(0);
          const next = friseEventsReloadFailure(
            {
              from: requestFrom,
              to: requestTo,
              category: requestCategory,
              city: requestCity,
              search: requestSearch,
            },
            message,
          );
          setError(next.error);
          setSettled(next.settled);
        },
      },
    );
  }, [
    enabled,
    category,
    city,
    search,
    load,
    window.fromKey,
    window.toKey,
  ]);

  useEffect(() => {
    if (!enabled) {
      // Invalide les chargements en vol : plus aucun commit UI.
      loadGenerationRef.current += 1;
      return;
    }
    // Invalide tout de suite (avant le microtask) pour qu’une réponse
    // A ne committe pas pendant que l’UI affiche déjà B.
    loadGenerationRef.current += 1;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
      // Démontage ou changement de params / fenêtre : stoppe pagination + commits.
      loadGenerationRef.current += 1;
    };
  }, [enabled, reload]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setAnchorMonth(parisMonthStartKey());
    });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const dataStart = parisMonthStartKey();
  const maxAnchor = shiftFriezeAnchor(dataStart, 3);
  const canPrev = anchorMonth > dataStart;
  const canNext = anchorMonth < maxAnchor;

  return {
    model,
    /** Désactivé → pas de spinner, même si un fetch périmé est encore en mémoire. */
    loading: enabled && loading,
    error,
    totalCount,
    reload,
    canPrev,
    canNext,
    goPrev: () => {
      if (!canPrev) return;
      setAnchorMonth((a) => shiftFriezeAnchor(a, -3));
    },
    goNext: () => {
      if (!canNext) return;
      setAnchorMonth((a) => shiftFriezeAnchor(a, 3));
    },
    goToday: () => setAnchorMonth(parisMonthStartKey()),
  };
}
