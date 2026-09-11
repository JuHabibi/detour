"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadExplorerEvents,
  type LoadExplorerEventsResult,
} from "@/app/actions/load-explorer-events";
import {
  categoryIdToExplorerFilter,
  cityToExplorerFilter,
} from "@/application/explorer/explorer-public-query";
import type { CategoryId, EventItem } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";

export const EXPLORER_LOAD_FALLBACK_ERROR =
  "Impossible de charger les sorties.";

export type ExplorerListSnapshot = {
  events: EventItem[];
  totalCount: number;
  nextCursor: string | null;
  error: string | null;
};

export type ExplorerInitialPage = {
  events: EventItem[];
  totalCount: number;
  nextCursor: string | null;
};

type FilterStamp = {
  when: WhenFilter;
  category: CategoryId;
  city: V1Commune | null;
  search: string;
};

function sameFilters(a: FilterStamp, b: FilterStamp): boolean {
  return (
    a.when === b.when &&
    a.category === b.category &&
    a.city === b.city &&
    a.search === b.search
  );
}

export function explorerPageOneSnapshotFromResult(
  result: LoadExplorerEventsResult,
): ExplorerListSnapshot {
  if (!result.ok) {
    return {
      events: [],
      totalCount: 0,
      nextCursor: null,
      error: result.error,
    };
  }
  return {
    events: result.events,
    totalCount: result.totalCount,
    nextCursor: result.nextCursor,
    error: null,
  };
}

export function explorerPageOneSnapshotFromRejection(): ExplorerListSnapshot {
  return {
    events: [],
    totalCount: 0,
    nextCursor: null,
    error: EXPLORER_LOAD_FALLBACK_ERROR,
  };
}

export function explorerAppendErrorMessage(
  result: LoadExplorerEventsResult | null,
): string {
  if (result && !result.ok) return result.error;
  return EXPLORER_LOAD_FALLBACK_ERROR;
}

type UseExplorerEventsParams = {
  initial: ExplorerInitialPage;
  when: WhenFilter;
  category: CategoryId;
  city: V1Commune | null;
  search: string;
  load?: typeof loadExplorerEvents;
};

/**
 * Orchestration async Explorer — page 1 / retry / pagination.
 * Pas d’analytics produit ici.
 */
export function useExplorerEvents({
  initial,
  when,
  category,
  city,
  search,
  load = loadExplorerEvents,
}: UseExplorerEventsParams) {
  const [events, setEvents] = useState(initial.events);
  const [totalCount, setTotalCount] = useState(initial.totalCount);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters: FilterStamp = { when, category, city, search };
  const committedFilters = useRef(filters);
  const latestFilters = useRef(filters);

  useEffect(() => {
    latestFilters.current = filters;
  });

  function applyPageOne(snapshot: ExplorerListSnapshot) {
    setEvents(snapshot.events);
    setTotalCount(snapshot.totalCount);
    setNextCursor(snapshot.nextCursor);
    setError(snapshot.error);
  }

  useEffect(() => {
    const next: FilterStamp = { when, category, city, search };
    if (sameFilters(committedFilters.current, next)) return;
    committedFilters.current = next;

    let ignore = false;
    setLoading(true);
    setError(null);

    void (async () => {
      let snapshot: ExplorerListSnapshot;
      try {
        const result = await load({
          when: next.when,
          search: next.search || undefined,
          category: categoryIdToExplorerFilter(next.category),
          city: cityToExplorerFilter(next.city),
          cursor: null,
        });
        snapshot = explorerPageOneSnapshotFromResult(result);
      } catch {
        snapshot = explorerPageOneSnapshotFromRejection();
      }
      if (ignore) return;
      applyPageOne(snapshot);
      setLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, [when, category, city, search, load]);

  async function reload() {
    const stamp = latestFilters.current;
    setLoading(true);
    setError(null);
    let snapshot: ExplorerListSnapshot;
    try {
      const result = await load({
        when: stamp.when,
        search: stamp.search || undefined,
        category: categoryIdToExplorerFilter(stamp.category),
        city: cityToExplorerFilter(stamp.city),
        cursor: null,
      });
      snapshot = explorerPageOneSnapshotFromResult(result);
    } catch {
      snapshot = explorerPageOneSnapshotFromRejection();
    }
    if (!sameFilters(latestFilters.current, stamp)) return;
    applyPageOne(snapshot);
    setLoading(false);
  }

  async function loadMore() {
    if (!nextCursor || loading || loadingMore) return;
    const cursor = nextCursor;
    const stamp = latestFilters.current;
    setLoadingMore(true);
    setError(null);

    try {
      const result = await load({
        when: stamp.when,
        search: stamp.search || undefined,
        category: categoryIdToExplorerFilter(stamp.category),
        city: cityToExplorerFilter(stamp.city),
        cursor,
      });
      if (!sameFilters(latestFilters.current, stamp)) return;

      if (!result.ok) {
        setError(explorerAppendErrorMessage(result));
        return;
      }

      setEvents((prev) => [...prev, ...result.events]);
      setTotalCount(result.totalCount);
      setNextCursor(result.nextCursor);
      setError(null);
    } catch {
      if (!sameFilters(latestFilters.current, stamp)) return;
      setError(explorerAppendErrorMessage(null));
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    events,
    totalCount,
    nextCursor,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
  };
}
