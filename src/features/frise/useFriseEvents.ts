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
  resolveFriezeWindow,
  shiftFriezeAnchor,
  type ExplorerFriezeModel,
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
 * Charge les pages frise. N’applique loading / succès / erreur
 * que tant que `isCurrent()` reste vrai (ignore les réponses périmées).
 */
export async function runFriseEventsReload(
  params: {
    category: CategoryId;
    city: V1Commune | null;
    search: string;
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
  const [truncatedByCap, setTruncatedByCap] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const window = resolveFriezeWindow(anchorMonth);
  const model: ExplorerFriezeModel = buildExplorerFrieze({
    events,
    window,
    fetchedCount,
    truncatedByCap,
  });

  const applyError = useCallback((message: string) => {
    setError(message);
    setEvents([]);
    setFetchedCount(0);
    setTruncatedByCap(false);
    setTotalCount(0);
  }, []);

  const reload = useCallback(async () => {
    if (!enabled || category === "tout") return;

    const loadId = ++loadGenerationRef.current;
    const isCurrent = () => loadId === loadGenerationRef.current;

    setError(null);

    await runFriseEventsReload(
      { category, city, search, load },
      {
        isCurrent,
        onLoading: setLoading,
        onSuccess: (data) => {
          setEvents(data.events);
          setFetchedCount(data.fetchedCount);
          setTruncatedByCap(data.truncatedByCap);
          setTotalCount(data.totalCount);
        },
        onError: applyError,
      },
    );
  }, [enabled, category, city, search, load, applyError]);

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
