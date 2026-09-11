"use client";

import { useEffect, useRef, useState } from "react";
import { loadExplorerEvents } from "@/app/actions/load-explorer-events";
import { CategoryFilter } from "@/components/CategoryFilter";
import { EventGrid } from "@/components/EventGrid";
import { ExplorationFilters } from "@/components/ExplorationFilters";
import {
  useExplorerEvents,
  type ExplorerInitialPage,
} from "@/components/useExplorerEvents";
import type { CategoryId } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";
import { captureProductEvent } from "@/lib/analytics";

export type { ExplorerInitialPage };

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

  const skipNextSearchTrack = useRef(true);
  const lastTrackedSearch = useRef("");

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

  const {
    events,
    totalCount,
    nextCursor,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
  } = useExplorerEvents({
    initial,
    when,
    category,
    city,
    search: debouncedSearch,
    load,
  });

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
                onClick={() => void reload()}
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
      onShowMore={canShowMore ? () => void loadMore() : undefined}
    />
  );
}
