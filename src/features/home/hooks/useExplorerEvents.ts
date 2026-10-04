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


export function appendExplorerEventsUnique(
  previous: EventItem[],
  incoming: EventItem[],
): EventItem[] {
  const seen = new Set(previous.map((event) => event.id));
  const added: EventItem[] = [];
  for (const event of incoming) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    added.push(event);
  }
  return added.length === 0 ? previous : [...previous, ...added];
}

type ExplorerPageOneHandle = {
  isCurrent: () => boolean;
};

type ExplorerLoadMoreHandle = {
  isCurrent: () => boolean;
  release: () => void;
};


export function createExplorerLoadSession() {
  let generation = 0;
  let loadMoreLocked = false;

  return {
   
    beginPageOne(): ExplorerPageOneHandle {
      const id = ++generation;
      loadMoreLocked = false;
      return { isCurrent: () => id === generation };
    },
   
    invalidate() {
      generation += 1;
      loadMoreLocked = false;
    },
 
    beginLoadMore(): ExplorerLoadMoreHandle | null {
      if (loadMoreLocked) return null;
      loadMoreLocked = true;
      const gen = generation;
      return {
        isCurrent: () => gen === generation,
        release: () => {
          if (gen === generation) loadMoreLocked = false;
        },
      };
    },
  };
}

type ExplorerLoadFn = typeof loadExplorerEvents;

export async function runExplorerPageOneLoad(
  params: {
    filters: FilterStamp;
    load: ExplorerLoadFn;
  },
  handlers: {
    isCurrent: () => boolean;
    onLoading: (loading: boolean) => void;
    onSettled: (snapshot: ExplorerListSnapshot) => void;
  },
): Promise<void> {
  const { isCurrent, onLoading, onSettled } = handlers;
  if (!isCurrent()) return;

  onLoading(true);

  try {
    let snapshot: ExplorerListSnapshot;
    try {
      const result = await params.load({
        when: params.filters.when,
        search: params.filters.search || undefined,
        category: categoryIdToExplorerFilter(params.filters.category),
        city: cityToExplorerFilter(params.filters.city),
        cursor: null,
      });
      snapshot = explorerPageOneSnapshotFromResult(result);
    } catch {
      snapshot = explorerPageOneSnapshotFromRejection();
    }

    if (!isCurrent()) return;
    onSettled(snapshot);
  } finally {
    if (isCurrent()) onLoading(false);
  }
}

export async function runExplorerLoadMore(
  params: {
    filters: FilterStamp;
    cursor: string;
    load: ExplorerLoadFn;
  },
  handlers: {
    isCurrent: () => boolean;
    release: () => void;
    onLoadingMore: (loading: boolean) => void;
    onAppend: (data: {
      events: EventItem[];
      totalCount: number;
      nextCursor: string | null;
    }) => void;
    onError: (message: string) => void;
  },
): Promise<void> {
  const { isCurrent, release, onLoadingMore, onAppend, onError } = handlers;
  if (!isCurrent()) {
    release();
    return;
  }

  onLoadingMore(true);

  try {
    const result = await params.load({
      when: params.filters.when,
      search: params.filters.search || undefined,
      category: categoryIdToExplorerFilter(params.filters.category),
      city: cityToExplorerFilter(params.filters.city),
      cursor: params.cursor,
    });

    if (!isCurrent()) return;

    if (!result.ok) {
      onError(explorerAppendErrorMessage(result));
      return;
    }

    onAppend({
      events: result.events,
      totalCount: result.totalCount,
      nextCursor: result.nextCursor,
    });
  } catch {
    if (!isCurrent()) return;
    onError(explorerAppendErrorMessage(null));
  } finally {
    if (isCurrent()) {
      release();
      onLoadingMore(false);
    }
  }
}

type UseExplorerEventsParams = {
  initial: ExplorerInitialPage;
  when: WhenFilter;
  category: CategoryId;
  city: V1Commune | null;
  search: string;
  load?: typeof loadExplorerEvents;
};


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
  const sessionRef = useRef(createExplorerLoadSession());
  const nextCursorRef = useRef(nextCursor);
  const loadingRef = useRef(loading);

  useEffect(() => {
    latestFilters.current = filters;
  });

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  function applyPageOne(snapshot: ExplorerListSnapshot) {
    setEvents(snapshot.events);
    setTotalCount(snapshot.totalCount);
    setNextCursor(snapshot.nextCursor);
    setError(snapshot.error);
  }

  useEffect(() => {
    const session = sessionRef.current;
    const next: FilterStamp = { when, category, city, search };

    if (sameFilters(committedFilters.current, next)) {
      return () => {
        session.invalidate();
      };
    }

    committedFilters.current = next;
    const page = session.beginPageOne();
    setLoadingMore(false);
    setError(null);

    void runExplorerPageOneLoad(
      { filters: next, load },
      {
        isCurrent: page.isCurrent,
        onLoading: setLoading,
        onSettled: applyPageOne,
      },
    );

    return () => {
      session.invalidate();
    };
  }, [when, category, city, search, load]);

  async function reload() {
    const session = sessionRef.current;
    const stamp = latestFilters.current;
    const page = session.beginPageOne();
    setLoadingMore(false);
    setError(null);

    await runExplorerPageOneLoad(
      { filters: stamp, load },
      {
        isCurrent: page.isCurrent,
        onLoading: setLoading,
        onSettled: applyPageOne,
      },
    );
  }

  async function loadMore() {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingRef.current) return;

    const session = sessionRef.current;
    const handle = session.beginLoadMore();
    if (!handle) return;

    const stamp = latestFilters.current;
    setError(null);

    await runExplorerLoadMore(
      { filters: stamp, cursor, load },
      {
        isCurrent: handle.isCurrent,
        release: handle.release,
        onLoadingMore: setLoadingMore,
        onAppend: (data) => {
          setEvents((prev) => appendExplorerEventsUnique(prev, data.events));
          setTotalCount(data.totalCount);
          setNextCursor(data.nextCursor);
          setError(null);
        },
        onError: (message) => {
          setError(message);
        },
      },
    );
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
