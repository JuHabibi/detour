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
  type FriseSettledScope,
} from "@/features/frise/frise-timeline-model";
import type { CategoryId, EventItem } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";

type UseFriseEventsParams = {
  /** Catégorie produit obligatoire (jamais « tout »). */
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
    let total = 0;
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

      total = result.totalCount;
      collected.push(...result.events);

      if (!result.nextCursor) break;
      if (collected.length >= EXPLORER_FRIEZE_HARD_CAP) {
        truncated = true;
        break;
      }
      cursor = result.nextCursor;
    }

    if (!isCurrent()) return;

    onSuccess({
      events: collected.slice(0, EXPLORER_FRIEZE_HARD_CAP),
      fetchedCount: Math.min(collected.length, EXPLORER_FRIEZE_HARD_CAP),
      truncatedByCap: truncated,
      totalCount: total,
    });
  } catch {
    if (!isCurrent()) return;
    onError("Impossible de charger la promenade.");
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
    if (!enabled || category === "tout") return;

    const loadId = ++loadGenerationRef.current;
    const isCurrent = () => loadId === loadGenerationRef.current;
    const requestFrom = window.fromKey;
    const requestTo = window.toKey;
    const requestCategory = category;

    setError(null);

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
          setError(null);
          setSettled({
            from: requestFrom,
            to: requestTo,
            category: requestCategory,
            status: data.truncatedByCap ? "truncated" : "complete",
          });
        },
        onError: (message) => {
          setError(message);
          setEvents([]);
          setFetchedCount(0);
          setTotalCount(0);
          setSettled({
            from: requestFrom,
            to: requestTo,
            category: requestCategory,
            status: "error",
          });
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
