"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadExplorerEvents,
  type LoadExplorerEventsResult,
} from "@/app/actions/load-explorer-events";
import {
  categoryIdToExplorerFilter,
  cityToExplorerFilter,
  isStaleExplorerRequest,
} from "@/application/explorer/explorer-public-query";
import { CategoryFilter } from "@/components/CategoryFilter";
import { EventGrid } from "@/components/EventGrid";
import { ExplorationFilters } from "@/components/ExplorationFilters";
import type { CategoryId, EventItem } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";

const SEARCH_DEBOUNCE_MS = 300;

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

  const requestSeq = useRef(0);
  const skipNextFilterFetch = useRef(true);
  const filtersRef = useRef({ when, category, city, search: debouncedSearch });
  filtersRef.current = {
    when,
    category,
    city,
    search: debouncedSearch,
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (skipNextFilterFetch.current) {
      skipNextFilterFetch.current = false;
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    void (async () => {
      const result = await load({
        when,
        search: debouncedSearch || undefined,
        category: categoryIdToExplorerFilter(category),
        city: cityToExplorerFilter(city),
        cursor: null,
      });
      if (isStaleExplorerRequest(seq, requestSeq.current)) return;
      applyReplace(result);
      setLoading(false);
    })();
  }, [when, category, city, debouncedSearch, load]);

  function applyReplace(result: LoadExplorerEventsResult) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEvents(result.events);
    setTotalCount(result.totalCount);
    setNextCursor(result.nextCursor);
    setError(null);
  }

  async function reloadPageOne() {
    const seq = ++requestSeq.current;
    const { when: w, category: c, city: ci, search: s } = filtersRef.current;
    setLoading(true);
    setError(null);
    const result = await load({
      when: w,
      search: s || undefined,
      category: categoryIdToExplorerFilter(c),
      city: cityToExplorerFilter(ci),
      cursor: null,
    });
    if (isStaleExplorerRequest(seq, requestSeq.current)) return;
    applyReplace(result);
    setLoading(false);
  }

  async function handleShowMore() {
    if (!nextCursor || loading || loadingMore) return;
    const seq = ++requestSeq.current;
    const { when: w, category: c, city: ci, search: s } = filtersRef.current;
    setLoadingMore(true);
    setError(null);

    const result = await load({
      when: w,
      search: s || undefined,
      category: categoryIdToExplorerFilter(c),
      city: cityToExplorerFilter(ci),
      cursor: nextCursor,
    });

    if (isStaleExplorerRequest(seq, requestSeq.current)) {
      setLoadingMore(false);
      return;
    }

    if (!result.ok) {
      setError(result.error);
      setLoadingMore(false);
      return;
    }

    setEvents((current) => [...current, ...result.events]);
    setTotalCount(result.totalCount);
    setNextCursor(result.nextCursor);
    setLoadingMore(false);
  }

  const canShowMore = Boolean(nextCursor) && !loading && !loadingMore;

  return (
    <EventGrid
      title="Explorer les sorties"
      resultTitle={GRID_RESULT_TITLES[when]}
      toolbar={
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:gap-3">
            <label className="block w-full min-w-0 lg:max-w-[36rem] lg:flex-1">
              <span className="sr-only">Recherche</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher un événement, un lieu..."
                className="h-11 w-full rounded-full border border-line bg-foam px-4 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-ink/20"
              />
            </label>
            <ExplorationFilters
              when={when}
              city={city}
              onWhenChange={setWhen}
              onCityChange={setCity}
            />
          </div>
          <CategoryFilter category={category} onCategoryChange={setCategory} />
          {loading || loadingMore ? (
            <p className="text-xs text-sand" aria-live="polite">
              {loadingMore ? "Chargement…" : "Mise à jour…"}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-coral" role="alert">
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
