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
import { CategoryFilter } from "@/components/CategoryFilter";
import { EventGrid } from "@/components/EventGrid";
import { ExplorationFilters } from "@/components/ExplorationFilters";
import type { CategoryId, EventItem } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";
import { captureProductEvent } from "@/lib/analytics";

const SEARCH_DEBOUNCE_MS = 300;
export const EXPLORER_LOAD_FALLBACK_ERROR =
  "Impossible de charger les sorties.";

export type ExplorerListSnapshot = {
  events: EventItem[];
  totalCount: number;
  nextCursor: string | null;
  error: string | null;
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

const GRID_RESULT_TITLES: Record<WhenFilter, string> = {
  today: "Aujourd’hui autour d’Orléans",
  tomorrow: "Demain autour d’Orléans",
  weekend: "Ce week-end autour d’Orléans",
  "next-week": "Semaine prochaine autour d’Orléans",
  "this-month": "Ce mois-ci autour d’Orléans",
  "next-month": "Mois prochain autour d’Orléans",
  upcoming: "À venir autour d’Orléans",
};

export type ExplorerInitialPage = {
  events: EventItem[];
  totalCount: number;
  nextCursor: string | null;
};

type ExplorerSectionProps = {
  initial: ExplorerInitialPage;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  /** Injectable pour tests — défaut : server action. */
  load?: typeof loadExplorerEvents;
};

export function ExplorerSection({
  initial,
  favorites,
  onToggleFavorite,
  load = loadExplorerEvents,
}: ExplorerSectionProps) {
  const [when, setWhen] = useState<WhenFilter>("weekend");
  const [category, setCategory] = useState<CategoryId>("tout");
  const [city, setCity] = useState<V1Commune | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [events, setEvents] = useState(initial.events);
  const [totalCount, setTotalCount] = useState(initial.totalCount);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipNextSearchTrack = useRef(true);
  const lastTrackedSearch = useRef("");

  const committedFilters = useRef<FilterStamp>({
    when,
    category,
    city,
    search: debouncedSearch,
  });
  const filtersRef = useRef<FilterStamp>({
    when,
    category,
    city,
    search: debouncedSearch,
  });
  filtersRef.current = {
    when,
    category,
    city,
    search: debouncedSearch,
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchInput.trim();
      setDebouncedSearch(next);
      if (skipNextSearchTrack.current) {
        skipNextSearchTrack.current = false;
        lastTrackedSearch.current = next;
        return;
      }
      if (next === lastTrackedSearch.current) return;
      lastTrackedSearch.current = next;
      captureProductEvent("filter_changed", {
        filter_name: "search",
        filter_value: next,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const next: FilterStamp = {
      when,
      category,
      city,
      search: debouncedSearch,
    };
    if (sameFilters(committedFilters.current, next)) return;
    committedFilters.current = next;

    let ignore = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const result = await load({
          when,
          search: debouncedSearch || undefined,
          category: categoryIdToExplorerFilter(category),
          city: cityToExplorerFilter(city),
          cursor: null,
        });
        if (ignore) return;
        applyListSnapshot(explorerPageOneSnapshotFromResult(result));
      } catch {
        if (ignore) return;
        applyListSnapshot(explorerPageOneSnapshotFromRejection());
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [when, category, city, debouncedSearch, load]);

  function applyListSnapshot(snapshot: ExplorerListSnapshot) {
    setEvents(snapshot.events);
    setTotalCount(snapshot.totalCount);
    setNextCursor(snapshot.nextCursor);
    setError(snapshot.error);
  }

  async function reloadPageOne() {
    const stamp = filtersRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await load({
        when: stamp.when,
        search: stamp.search || undefined,
        category: categoryIdToExplorerFilter(stamp.category),
        city: cityToExplorerFilter(stamp.city),
        cursor: null,
      });
      if (!sameFilters(filtersRef.current, stamp)) return;
      applyListSnapshot(explorerPageOneSnapshotFromResult(result));
    } catch {
      if (!sameFilters(filtersRef.current, stamp)) return;
      applyListSnapshot(explorerPageOneSnapshotFromRejection());
    } finally {
      if (sameFilters(filtersRef.current, stamp)) setLoading(false);
    }
  }

  async function handleShowMore() {
    if (!nextCursor || loading || loadingMore) return;
    const cursor = nextCursor;
    const stamp = filtersRef.current;
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
      if (!sameFilters(filtersRef.current, stamp)) return;

      if (!result.ok) {
        setError(explorerAppendErrorMessage(result));
        return;
      }

      setEvents((current) => [...current, ...result.events]);
      setTotalCount(result.totalCount);
      setNextCursor(result.nextCursor);
      setError(null);
    } catch {
      if (!sameFilters(filtersRef.current, stamp)) return;
      setError(explorerAppendErrorMessage(null));
    } finally {
      setLoadingMore(false);
    }
  }

  const canShowMore = Boolean(nextCursor) && !loading && !loadingMore;

  function trackFilterChanged(
    filterName: "when" | "city" | "category",
    filterValue: string,
  ) {
    captureProductEvent("filter_changed", {
      filter_name: filterName,
      filter_value: filterValue,
    });
  }

  function handleWhenChange(value: WhenFilter) {
    if (value === when) return;
    trackFilterChanged("when", value);
    setWhen(value);
  }

  function handleCityChange(value: V1Commune | null) {
    if (value === city) return;
    trackFilterChanged("city", value ?? "all");
    setCity(value);
  }

  function handleCategoryChange(value: CategoryId) {
    if (value === category) return;
    trackFilterChanged("category", value);
    setCategory(value);
  }

  return (
    <EventGrid
      title="Explorer les sorties"
      resultTitle={GRID_RESULT_TITLES[when]}
      toolbar={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <label className="block w-full min-w-0 sm:max-w-md sm:flex-1 lg:max-w-[28rem]">
              <span className="sr-only">Recherche</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher un événement, un lieu..."
                className="h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint"
              />
            </label>
            <ExplorationFilters
              when={when}
              city={city}
              onWhenChange={handleWhenChange}
              onCityChange={handleCityChange}
            />
          </div>
          <CategoryFilter
            category={category}
            onCategoryChange={handleCategoryChange}
          />
          <p
            className="min-h-5 text-sm text-sand"
            aria-live="polite"
            aria-hidden={!(loading || loadingMore)}
          >
            {loadingMore ? "Chargement…" : loading ? "Mise à jour…" : "\u00a0"}
          </p>
          {error ? (
            <p className="text-sm text-coral" role="alert">
              {error}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void reloadPageOne()}
              >
                Réessayer
              </button>
            </p>
          ) : null}
        </div>
      }
      events={events}
      totalCount={totalCount}
      favorites={favorites}
      onToggleFavorite={onToggleFavorite}
      onShowMore={canShowMore ? () => void handleShowMore() : undefined}
    />
  );
}
