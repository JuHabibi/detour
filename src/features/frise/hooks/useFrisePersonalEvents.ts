"use client";

import { useCallback, useMemo, useState } from "react";
import type { CategoryId, EventItem } from "@/data/types";
import { filterEventsByFriseCategory } from "@/features/frise/frise-url-state";
import {
  buildExplorerFrieze,
  parisMonthStartKey,
  resolveFriezeWindow,
  shiftFriezeAnchor,
  type ExplorerFriezeModel,
  type FriseCoverageStatus,
} from "@/features/frise/timeline/frise-timeline-model";

type UseFrisePersonalEventsParams = {
  /** Corpus perso déjà chargé (favoris ou carnet). */
  sourceEvents: EventItem[];
  category: CategoryId | null;
  /** false tant que le corpus n’est pas hydraté. */
  enabled: boolean;
  /** true pendant le fetch du corpus. */
  sourceLoading?: boolean;
  sourceError?: string | null;
};

export type FrisePersonalEmptyKind =
  | "none"
  | "collection_empty"
  | "category_empty"
  | "trimester_empty";

/**
 * Même moteur temporel que useFriseEvents, sur un corpus personnel en mémoire.
 * Filtre catégorie côté client ; la fenêtre trimestre via buildExplorerFrieze.
 */
export function useFrisePersonalEvents({
  sourceEvents,
  category,
  enabled,
  sourceLoading = false,
  sourceError = null,
}: UseFrisePersonalEventsParams) {
  const [anchorMonth, setAnchorMonth] = useState(() => parisMonthStartKey());

  const window = resolveFriezeWindow(anchorMonth);

  const categoryFiltered = useMemo(
    () =>
      filterEventsByFriseCategory(sourceEvents, category) as EventItem[],
    [sourceEvents, category],
  );

  const coverageStatus: FriseCoverageStatus = sourceLoading
    ? "pending"
    : sourceError
      ? "error"
      : "complete";

  const model: ExplorerFriezeModel = buildExplorerFrieze({
    events: coverageStatus === "complete" ? categoryFiltered : [],
    window,
    fetchedCount: categoryFiltered.length,
    truncatedByCap: false,
    coverageStatus,
  });

  const emptyKind: FrisePersonalEmptyKind = (() => {
    if (!enabled || sourceLoading || sourceError) return "none";
    if (sourceEvents.length === 0) return "collection_empty";
    if (categoryFiltered.length === 0) return "category_empty";
    if (model.eventCountInWindow === 0) return "trimester_empty";
    return "none";
  })();

  const dataStart = parisMonthStartKey();
  const maxAnchor = shiftFriezeAnchor(dataStart, 3);
  const canPrev = anchorMonth > dataStart;
  const canNext = anchorMonth < maxAnchor;

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    setAnchorMonth((a) => shiftFriezeAnchor(a, -3));
  }, [canPrev]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    setAnchorMonth((a) => shiftFriezeAnchor(a, 3));
  }, [canNext]);

  const goToday = useCallback(() => {
    setAnchorMonth(parisMonthStartKey());
  }, []);

  return {
    model,
    loading: enabled && sourceLoading,
    error: sourceError,
    totalCount: model.eventCountInWindow,
    sourceCount: sourceEvents.length,
    categoryFilteredCount: categoryFiltered.length,
    emptyKind,
    canPrev,
    canNext,
    goPrev,
    goNext,
    goToday,
    reload: () => undefined,
  };
}
