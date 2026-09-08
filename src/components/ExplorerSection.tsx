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

/** Message sobré si la Server Action rejette (réseau / transport). */
export const EXPLORER_LOAD_FALLBACK_ERROR =
  "Impossible de charger les sorties.";

export type ExplorerListSnapshot = {
  events: EventItem[];
  totalCount: number;
  nextCursor: string | null;
  error: string | null;
};

/** Remplacement page 1 à partir d’un résultat action (ok ou ok:false). */
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

/** Remplacement page 1 après rejet de promesse. */
export function explorerPageOneSnapshotFromRejection(): ExplorerListSnapshot {
  return {
    events: [],
    totalCount: 0,
    nextCursor: null,
    error: EXPLORER_LOAD_FALLBACK_ERROR,
  };
}

/** Message d’erreur append — les cartes / cursor restent chez l’appelant. */
export function explorerAppendErrorMessage(
  result: LoadExplorerEventsResult | null,
): string {
  if (result && !result.ok) return result.error;
  return EXPLORER_LOAD_FALLBACK_ERROR;
}

/**
 * Appliquer une réponse page 1 seulement si la requête n’est pas stale.
 * Le flag loading se clear uniquement pour la requête courante.
 */
export function shouldCommitExplorerPageOne(
  requestSeq: number,
  latestSeq: number,
): boolean {
  return !isStaleExplorerRequest(requestSeq, latestSeq);
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
      try {
        const result = await load({
          when,
          search: debouncedSearch || undefined,
          category: categoryIdToExplorerFilter(category),
          city: cityToExplorerFilter(city),
          cursor: null,
        });
        if (!shouldCommitExplorerPageOne(seq, requestSeq.current)) return;
        applyListSnapshot(explorerPageOneSnapshotFromResult(result));
      } catch {
        if (!shouldCommitExplorerPageOne(seq, requestSeq.current)) return;
        applyListSnapshot(explorerPageOneSnapshotFromRejection());
      } finally {
        if (shouldCommitExplorerPageOne(seq, requestSeq.current)) {
          setLoading(false);
        }
      }
    })();
  }, [when, category, city, debouncedSearch, load]);

  function applyListSnapshot(snapshot: ExplorerListSnapshot) {
    setEvents(snapshot.events);
    setTotalCount(snapshot.totalCount);
    setNextCursor(snapshot.nextCursor);
    setError(snapshot.error);
  }

  async function reloadPageOne() {
    const seq = ++requestSeq.current;
    const { when: w, category: c, city: ci, search: s } = filtersRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await load({
        when: w,
        search: s || undefined,
        category: categoryIdToExplorerFilter(c),
        city: cityToExplorerFilter(ci),
        cursor: null,
      });
      if (!shouldCommitExplorerPageOne(seq, requestSeq.current)) return;
      applyListSnapshot(explorerPageOneSnapshotFromResult(result));
    } catch {
      if (!shouldCommitExplorerPageOne(seq, requestSeq.current)) return;
      applyListSnapshot(explorerPageOneSnapshotFromRejection());
    } finally {
      if (shouldCommitExplorerPageOne(seq, requestSeq.current)) {
        setLoading(false);
      }
    }
  }

  async function handleShowMore() {
    if (!nextCursor || loading || loadingMore) return;
    const seq = ++requestSeq.current;
    const cursor = nextCursor;
    const { when: w, category: c, city: ci, search: s } = filtersRef.current;
    setLoadingMore(true);
    setError(null);

    try {
      const result = await load({
        when: w,
        search: s || undefined,
        category: categoryIdToExplorerFilter(c),
        city: cityToExplorerFilter(ci),
        cursor,
      });

      if (isStaleExplorerRequest(seq, requestSeq.current)) return;

      if (!result.ok) {
        setError(explorerAppendErrorMessage(result));
        return;
      }

      setEvents((current) => [...current, ...result.events]);
      setTotalCount(result.totalCount);
      setNextCursor(result.nextCursor);
      setError(null);
    } catch {
      if (isStaleExplorerRequest(seq, requestSeq.current)) return;
      setError(explorerAppendErrorMessage(null));
    } finally {
      // Toujours sortir de loadingMore : une requête append terminée
      // (même stale après un nouveau filtre) ne doit pas bloquer l’UI.
      setLoadingMore(false);
    }
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
