"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadExplorerEvents } from "@/app/actions/load-explorer-events";
import { EventGrid } from "@/features/explorer/components/EventGrid";
import { ExplorerFilterBar } from "@/features/explorer/components/ExplorerFilterBar";
import {
  explorerPeriodEmptyMessage,
  explorerPeriodResultTitle,
} from "@/features/explorer/explorer-period-copy";
import {
  explorerUrlHref,
  parseExplorerUrlState,
  sameExplorerUrlState,
  type ExplorerUrlState,
} from "@/features/explorer/explorer-url-state";
import {
  useExplorerEvents,
  type ExplorerInitialPage,
} from "@/features/explorer/hooks/useExplorerEvents";
import type { CategoryId, EventItem } from "@/data/types";
import type { V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";
import { captureProductEvent } from "@/lib/analytics";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";

export type { ExplorerInitialPage };

const SEARCH_DEBOUNCE_MS = 300;

type ExplorerSectionProps = {
  initial: ExplorerInitialPage;
  initialFilters: ExplorerUrlState;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  carnetCounts?: Map<string, number>;
  onOrganizeCarnets?: (event: EventItem) => void;
  onOpenDetail?: OpenEventDetailHandler;
  /** Injectable pour tests — défaut : server action. */
  load?: typeof loadExplorerEvents;
};

export function ExplorerSection({
  initial,
  initialFilters,
  favorites,
  onToggleFavorite,
  carnetCounts,
  onOrganizeCarnets,
  onOpenDetail,
  load = loadExplorerEvents,
}: ExplorerSectionProps) {
  const router = useRouter();
  const [when, setWhen] = useState<WhenFilter>(initialFilters.when);
  const [rangeFrom, setRangeFrom] = useState<string | null>(initialFilters.from);
  const [rangeTo, setRangeTo] = useState<string | null>(initialFilters.to);
  const [category, setCategory] = useState<CategoryId>(initialFilters.category);
  const [city, setCity] = useState<V1Commune | null>(initialFilters.city);
  const [searchInput, setSearchInput] = useState(initialFilters.q);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.q);

  const skipNextSearchTrack = useRef(true);
  const lastTrackedSearch = useRef(initialFilters.q);
  const urlWriteMode = useRef<"push" | "replace" | null>(null);

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
      urlWriteMode.current = "replace";
      captureProductEvent("filter_changed", {
        filter_name: "search",
        filter_value: next,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Sync URL ← state (push pour filtres explicites, replace pour search / normalize).
  useEffect(() => {
    const urlState: ExplorerUrlState = {
      when,
      from: when === "range" ? rangeFrom : null,
      to: when === "range" ? rangeTo : null,
      q: debouncedSearch,
      city,
      category,
    };
    const href = explorerUrlHref(urlState);
    const currentState = parseExplorerUrlState(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    );
    if (sameExplorerUrlState(urlState, currentState)) {
      urlWriteMode.current = null;
      return;
    }
    const mode = urlWriteMode.current ?? "replace";
    urlWriteMode.current = null;
    if (mode === "push") {
      router.push(href, { scroll: false });
    } else {
      router.replace(href, { scroll: false });
    }
  }, [when, rangeFrom, rangeTo, debouncedSearch, city, category, router]);

  // Sync state ← URL (back / forward).
  useEffect(() => {
    function onPopState() {
      const next = parseExplorerUrlState(
        Object.fromEntries(new URLSearchParams(window.location.search)),
      );
      setWhen(next.when);
      setRangeFrom(next.from);
      setRangeTo(next.to);
      setCategory(next.category);
      setCity(next.city);
      setSearchInput(next.q);
      setDebouncedSearch(next.q);
      lastTrackedSearch.current = next.q;
      skipNextSearchTrack.current = true;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    from: when === "range" ? rangeFrom : null,
    to: when === "range" ? rangeTo : null,
    category,
    city,
    search: debouncedSearch,
    load,
  });

  const canShowMore = Boolean(nextCursor) && !loading && !loadingMore;
  const range =
    when === "range" && rangeFrom && rangeTo
      ? { from: rangeFrom, to: rangeTo }
      : null;

  function trackFilterChanged(
    filterName: "when" | "city" | "category",
    filterValue: string,
  ) {
    captureProductEvent("filter_changed", {
      filter_name: filterName,
      filter_value: filterValue,
    });
  }

  function handlePresetChange(value: Exclude<WhenFilter, "range">) {
    urlWriteMode.current = "push";
    trackFilterChanged("when", value);
    setWhen(value);
    setRangeFrom(null);
    setRangeTo(null);
  }

  function handleRangeApply(from: string, to: string) {
    urlWriteMode.current = "push";
    trackFilterChanged("when", `range:${from}:${to}`);
    setWhen("range");
    setRangeFrom(from);
    setRangeTo(to);
  }

  function handleCityChange(value: V1Commune | null) {
    if (value === city) return;
    urlWriteMode.current = "push";
    trackFilterChanged("city", value ?? "all");
    setCity(value);
  }

  function handleCategoryChange(value: CategoryId) {
    if (value === category) return;
    urlWriteMode.current = "push";
    trackFilterChanged("category", value);
    setCategory(value);
  }

  return (
    <EventGrid
      title="Explorer les sorties"
      resultTitle={explorerPeriodResultTitle(when, range)}
      emptyMessage={explorerPeriodEmptyMessage(when, range)}
      toolbar={
        <div className="flex flex-col">
          <ExplorerFilterBar
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            when={when}
            from={rangeFrom}
            to={rangeTo}
            onPresetChange={handlePresetChange}
            onRangeApply={handleRangeApply}
            city={city}
            onCityChange={handleCityChange}
            category={category}
            onCategoryChange={handleCategoryChange}
          />
          <p
            className={
              loading || loadingMore
                ? "mt-2 min-h-4 text-[12px] text-sand"
                : "sr-only"
            }
            aria-live="polite"
          >
            {loadingMore ? "Chargement…" : loading ? "Mise à jour…" : ""}
          </p>
          {error ? (
            <p className="mt-2 text-sm text-coral" role="alert">
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
      carnetCounts={carnetCounts}
      onOrganizeCarnets={onOrganizeCarnets}
      onOpenDetail={onOpenDetail}
      onShowMore={canShowMore ? () => void loadMore() : undefined}
    />
  );
}
