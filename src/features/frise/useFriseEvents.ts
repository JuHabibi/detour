"use client";

import { useCallback, useEffect, useState } from "react";
import { loadExplorerEvents } from "@/app/actions/load-explorer-events";
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

  const window = resolveFriezeWindow(anchorMonth);
  const model: ExplorerFriezeModel = buildExplorerFrieze({
    events,
    window,
    fetchedCount,
    truncatedByCap,
  });

  const reload = useCallback(async () => {
    if (!enabled || category === "tout") return;
    setLoading(true);
    setError(null);

    try {
      const collected: EventItem[] = [];
      let cursor: string | null = null;
      let total = 0;
      let truncated = false;

      while (collected.length < EXPLORER_FRIEZE_HARD_CAP) {
        const result = await load({
          when: "upcoming",
          category: categoryIdToExplorerFilter(category) ?? null,
          city: cityToExplorerFilter(city) ?? null,
          search: search || null,
          cursor,
          limit: EXPLORER_FRIEZE_PAGE_SIZE,
        });

        if (!result.ok) {
          setError(result.error);
          setEvents([]);
          setFetchedCount(0);
          setTruncatedByCap(false);
          setTotalCount(0);
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

      setEvents(collected.slice(0, EXPLORER_FRIEZE_HARD_CAP));
      setFetchedCount(Math.min(collected.length, EXPLORER_FRIEZE_HARD_CAP));
      setTruncatedByCap(truncated);
      setTotalCount(total);
    } catch {
      setError("Impossible de charger la promenade.");
      setEvents([]);
      setFetchedCount(0);
      setTruncatedByCap(false);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, category, city, search, load]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  useEffect(() => {
    setAnchorMonth(parisMonthStartKey());
  }, [category]);

  const dataStart = parisMonthStartKey();
  const maxAnchor = shiftFriezeAnchor(dataStart, 3);
  const canPrev = anchorMonth > dataStart;
  const canNext = anchorMonth < maxAnchor;

  return {
    model,
    loading,
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
