"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { addFavorite } from "@/app/actions/favorites";
import type { GroupSummary } from "@/application/groups";
import { categories } from "@/config/event-categories";
import type { CategoryId, EventItem } from "@/data/types";
import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import { useRemoveFavorite } from "@/components/favorites/useRemoveFavorite";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { CategoryFilter } from "@/components/event/CategoryFilter";
import { FriseEmptyState } from "@/features/frise/components/FriseEmptyState";
import { FriseCarnetThumbs } from "@/features/frise/components/FriseCarnetThumbs";
import { FriseViewNav } from "@/features/frise/components/FriseViewNav";
import { FriseRideTrack } from "@/features/frise/components/FriseRideTrack";
import {
  buildFriseHref,
  type FriseView,
} from "@/features/frise/frise-url-state";
import { useFriseEvents } from "@/features/frise/hooks/useFriseEvents";
import { useFrisePersonalData } from "@/features/frise/hooks/useFrisePersonalData";
import { useFrisePersonalEvents } from "@/features/frise/hooks/useFrisePersonalEvents";
import { cn } from "@/lib/cn";
import type { DetourCategory } from "@/domain/events/classify-event-category";

const RIDE_CATEGORIES = categories.filter(
  (c): c is { id: DetourCategory; label: string } => c.id !== "tout",
);

const EMPTY_EVENTS: EventItem[] = [];

type FrisePageClientProps = {
  initialView: FriseView;
  initialCategory: CategoryId | null;
  initialNotebookId: string | null;
  user?: { name: string; email: string } | null;
};

function categoryLabelFor(category: CategoryId | null): string {
  if (!category || category === "tout") return "Toutes les catégories";
  return RIDE_CATEGORIES.find((c) => c.id === category)?.label ?? "Catégorie";
}

function readPreviewFlag(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1"
  );
}

/** Sélection carnet après hydratation — pur, sans navigation ni setState. */
function resolveNotebookSelectionAfterGroupsLoad(
  currentId: string | null,
  groups: readonly Pick<GroupSummary, "id">[],
): string | null {
  if (currentId && !groups.some((group) => group.id === currentId)) {
    return null;
  }
  if (!currentId && groups.length === 1) {
    return groups[0]!.id;
  }
  return currentId;
}

export function FrisePageClient({
  initialView,
  initialCategory,
  initialNotebookId,
  user = null,
}: FrisePageClientProps) {
  const router = useRouter();
  const [view, setView] = useState<FriseView>(initialView);
  const [category, setCategory] = useState<CategoryId | null>(initialCategory);
  const [discoverCategory, setDiscoverCategory] = useState<CategoryId | null>(
    initialView === "all" ? initialCategory : null,
  );
  const [notebookId, setNotebookId] = useState<string | null>(
    initialNotebookId,
  );
  const notebookIdRef = useRef(notebookId);
  const [detail, setDetail] = useState<{
    event: EventItem;
    returnFocusTo: HTMLElement | null;
  } | null>(null);

  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    notebookIdRef.current = notebookId;
  }, [notebookId]);

  const replaceUrl = useCallback(
    (next: {
      view: FriseView;
      category: CategoryId | null;
      notebookId: string | null;
    }) => {
      const href = buildFriseHref({
        view: next.view,
        category: next.category,
        notebookId: next.notebookId,
        preview: readPreviewFlag(),
      });
      router.replace(href, { scroll: false });
    },
    [router],
  );

  const onGroupsLoaded = useCallback(
    (nextGroups: GroupSummary[]) => {
      const current = notebookIdRef.current;
      const next = resolveNotebookSelectionAfterGroupsLoad(current, nextGroups);
      if (next === current) return;
      notebookIdRef.current = next;
      setNotebookId(next);
      replaceUrl({ view: "notebook", category, notebookId: next });
    },
    [category, replaceUrl],
  );

  const onNotebookMissing = useCallback(() => {
    setNotebookId(null);
    replaceUrl({ view: "notebook", category, notebookId: null });
  }, [category, replaceUrl]);

  const {
    favoriteIds,
    favoriteEvents,
    favoriteEventsLoading,
    favoriteEventsError,
    groups,
    groupsLoading,
    notebookEvents,
    notebookLoading,
    notebookError,
    notebookName,
    addFavoriteLocally,
    rollbackFavoriteAdd,
    setFavoriteIds,
    removeEventLocally,
  } = useFrisePersonalData({
    view,
    notebookId,
    onGroupsLoaded,
    onNotebookMissing,
  });

  const {
    requestRemove,
    confirmation: removeConfirmation,
    error: removeError,
    clearError: clearRemoveError,
  } = useRemoveFavorite({
    onRemoved: removeEventLocally,
    fallbackFocusSelector:
      'nav[aria-label="Mode de mon parcours culturel"] button[aria-current="page"]',
  });

  useEffect(() => {
    if (view === "all") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("category")) return;

    router.replace(
      buildFriseHref({
        view,
        category: "tout",
        notebookId,
        preview: readPreviewFlag(),
      }),
      { scroll: false },
    );
  }, [notebookId, router, view]);

  function toggleFavorite(id: string) {
    setFavoriteError(null);
    clearRemoveError();
    if (favoriteIds.has(id)) {
      requestRemove(id);
      return;
    }

    addFavoriteLocally(id);

    startTransition(async () => {
      try {
        const result = await addFavorite(id);
        if (result.ok) return;
      } catch (error) {
        console.error("[detour:frise] toggleFavorite failed", error);
      }
      rollbackFavoriteAdd(id);
      setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
    });
  }

  const explorerFrise = useFriseEvents({
    category:
      category && category !== "tout"
        ? category
        : category === "tout"
          ? "tout"
          : "Musique",
    city: null,
    search: "",
    enabled: view === "all" && category != null,
  });

  const favoritesFrise = useFrisePersonalEvents({
    sourceEvents: view === "favorites" ? favoriteEvents : EMPTY_EVENTS,
    category: "tout",
    enabled: view === "favorites",
    sourceLoading: favoriteEventsLoading,
    sourceError: favoriteEventsError,
  });

  const notebookFrise = useFrisePersonalEvents({
    sourceEvents: view === "notebook" ? notebookEvents : EMPTY_EVENTS,
    category: "tout",
    enabled: view === "notebook" && Boolean(notebookId),
    sourceLoading: notebookLoading || groupsLoading,
    sourceError: notebookError,
  });

  const activeFrise =
    view === "favorites"
      ? favoritesFrise
      : view === "notebook"
        ? notebookFrise
        : explorerFrise;

  const countTone =
    view === "favorites" ? "favoris" : view === "notebook" ? "carnet" : "sorties";
  const trackLabel =
    view === "all"
      ? categoryLabelFor(category)
      : view === "favorites"
        ? "Mes favoris"
        : notebookName ?? "Mes carnets";

  const onOpenDetail = useCallback(
    (
      event: EventItem,
      _surface: "radar" | "explorer",
      trigger?: HTMLElement | null,
    ) => {
      setDetail({ event, returnFocusTo: trigger ?? null });
    },
    [],
  );

  function selectView(next: FriseView) {
    setView(next);
    const nextCategory: CategoryId | null =
      next === "all" ? discoverCategory : "tout";
    let nextNotebookId = notebookId;

    if (next === "all") {
      nextNotebookId = null;
      setNotebookId(null);
    }
    if (next !== "notebook") {
      nextNotebookId = null;
      setNotebookId(null);
    }

    setCategory(nextCategory);
    replaceUrl({
      view: next,
      category: nextCategory,
      notebookId: nextNotebookId,
    });
  }

  function selectCategory(next: CategoryId) {
    setCategory(next);
    if (view === "all") {
      setDiscoverCategory(next);
    }
    replaceUrl({ view, category: next, notebookId });
  }

  function selectNotebook(nextId: string) {
    setNotebookId(nextId);
    replaceUrl({ view: "notebook", category: "tout", notebookId: nextId });
  }

  const backHref = useMemo(() => "/explorer", []);
  const showTrack =
    view === "all"
      ? category != null
      : view === "favorites"
        ? favoritesFrise.emptyKind === "none" ||
          favoritesFrise.emptyKind === "trimester_empty"
        : Boolean(notebookId) &&
          (notebookFrise.emptyKind === "none" ||
            notebookFrise.emptyKind === "trimester_empty");

  const showTrimesterNav =
    view === "all"
      ? category != null
      : view === "favorites"
        ? !favoriteEventsLoading && favoriteEvents.length > 0
        : Boolean(notebookId) &&
          !notebookLoading &&
          notebookEvents.length > 0;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as Window & {
      __friseSetFavoriteIds?: (ids: string[]) => void;
    };
    w.__friseSetFavoriteIds = (ids: string[]) => {
      setFavoriteIds(ids);
      setFavoriteError(null);
    };
    return () => {
      delete w.__friseSetFavoriteIds;
    };
  }, [setFavoriteIds]);

  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={favoriteIds.size}
        homeHref="/"
        user={user}
        showFriseNav={Boolean(user)}
      />
      {user ? <PendingFavoriteAfterAuthGate enabled /> : null}

      <div className="detour-decor detour-decor--explorer relative overflow-x-clip">
        <div className="relative z-[1] mx-auto max-w-[var(--detour-shell-max)] px-5 pb-14 pt-3 md:px-10 md:pb-16 md:pt-6 lg:px-16 2xl:px-20">
          <div className="mb-3 min-w-0 md:mb-4">
            <Link
              href={backHref}
              className="inline-flex min-h-8 items-center text-[11px] font-medium uppercase tracking-[0.14em] text-sand underline decoration-mint/70 decoration-2 underline-offset-4 transition-colors hover:text-ink motion-reduce:transition-none"
            >
              ← Retour à Explorer
            </Link>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
              Mon parcours culturel
            </p>
            <h1 className="mt-1 max-w-[18ch] font-display text-[1.75rem] leading-[1.02] tracking-tight text-ink md:text-[2.2rem]">
              Prenez le temps de faire un détour.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cream-dim md:text-base">
              Parcourez les sorties à venir au fil du temps, retrouvez vos
              favoris et explorez vos carnets sur une même frise.
            </p>
          </div>

          <div className="mb-3 border-b border-line md:mb-4">
            <FriseViewNav value={view} onChange={selectView} />
          </div>

          <div
            className={cn(
              "mb-4 flex flex-col gap-3 md:mb-5",
              view === "notebook"
                ? "md:gap-3"
                : "md:flex-row md:items-center md:justify-between md:gap-5",
            )}
          >
            {view === "notebook" ? (
              <div className="min-w-0">
                {groupsLoading ? (
                  <p className="text-sm text-sand">Chargement des carnets…</p>
                ) : groups.length === 0 ? (
                  <FriseEmptyState
                    title="Aucun carnet pour l’instant."
                    description="Créez jusqu’à quatre collections personnelles pour organiser vos découvertes."
                    ctaLabel="Voir mes carnets"
                    ctaHref="/account"
                  />
                ) : (
                  <FriseCarnetThumbs
                    groups={groups}
                    selectedId={notebookId}
                    onSelect={selectNotebook}
                  />
                )}
              </div>
            ) : null}

            {view === "all" ? (
              <CategoryFilter
                category={category}
                onCategoryChange={selectCategory}
                presentation="menu"
                allLabel="Toutes les catégories"
              />
            ) : null}
          </div>

          {view === "all" && !category ? (
            <p className="mb-6 max-w-md font-editorial text-xl leading-snug text-ink md:text-2xl">
              Choisissez une catégorie pour lancer mon parcours culturel.
            </p>
          ) : null}

          {view === "favorites" &&
          favoritesFrise.emptyKind === "collection_empty" &&
          !favoriteEventsLoading ? (
            <FriseEmptyState
              title="Votre parcours attend ses premières découvertes."
              description="Explorez le Radar ou les événements à venir et gardez ceux qui vous intéressent."
              ctaLabel="Explorer les événements"
              ctaHref="/explorer"
            />
          ) : null}

          {view === "favorites" &&
          favoritesFrise.emptyKind === "category_empty" ? (
            <FriseEmptyState
              title="Rien dans cette catégorie."
              description="Vos favoris sont ailleurs — élargissez le filtre ou choisissez Toutes les catégories."
              ctaLabel="Toutes les catégories"
              onCtaClick={() => selectCategory("tout")}
            />
          ) : null}

          {view === "notebook" &&
          notebookId &&
          notebookFrise.emptyKind === "collection_empty" &&
          !notebookLoading ? (
            <FriseEmptyState
              title="Ce carnet attend ses premières sorties."
              description="Ajoutez-y des événements depuis vos favoris pour commencer à tracer votre parcours."
              ctaLabel="Voir mes favoris"
              onCtaClick={() => selectView("favorites")}
            />
          ) : null}

          {view === "notebook" &&
          notebookId &&
          notebookFrise.emptyKind === "category_empty" ? (
            <FriseEmptyState
              title="Rien dans cette catégorie."
              description={
                notebookName
                  ? `Aucune sortie « ${categoryLabelFor(category)} » dans « ${notebookName} » sur vos enregistrements.`
                  : "Élargissez le filtre pour revoir les sorties de ce carnet."
              }
              ctaLabel="Toutes les catégories"
              onCtaClick={() => selectCategory("tout")}
            />
          ) : null}

          {view === "notebook" && groups.length > 0 && !notebookId ? (
            <p className="mb-6 max-w-md font-editorial text-xl leading-snug text-ink md:text-2xl">
              Choisissez un carnet pour le parcourir sur la frise.
            </p>
          ) : null}

          {view === "favorites" &&
          favoritesFrise.emptyKind === "trimester_empty" ? (
            <div className="mb-5">
              <FriseEmptyState
                title="Rien à l’horizon pour cette période."
                description="Essayez le trimestre suivant pour poursuivre votre promenade."
                ctaLabel="Trimestre suivant"
                onCtaClick={
                  favoritesFrise.canNext
                    ? favoritesFrise.goNext
                    : favoritesFrise.goToday
                }
              />
            </div>
          ) : null}

          {view === "notebook" &&
          notebookFrise.emptyKind === "trimester_empty" ? (
            <div className="mb-5">
              <FriseEmptyState
                title="Rien à l’horizon pour cette période."
                description="Essayez le trimestre suivant pour poursuivre votre promenade."
                ctaLabel="Trimestre suivant"
                onCtaClick={
                  notebookFrise.canNext
                    ? notebookFrise.goNext
                    : notebookFrise.goToday
                }
              />
            </div>
          ) : null}

          {view === "all" &&
          category != null &&
          !explorerFrise.loading &&
          explorerFrise.model.coverageStatus === "complete" &&
          explorerFrise.model.eventCountInWindow === 0 ? (
            <div className="mb-5">
              <FriseEmptyState
                title="Rien à l’horizon pour cette période."
                description="Essayez le trimestre suivant pour poursuivre votre promenade."
                ctaLabel="Trimestre suivant"
                onCtaClick={
                  explorerFrise.canNext
                    ? explorerFrise.goNext
                    : explorerFrise.goToday
                }
              />
            </div>
          ) : null}

          {showTrack &&
          !(
            (view === "favorites" &&
              favoritesFrise.emptyKind === "trimester_empty") ||
            (view === "notebook" &&
              notebookFrise.emptyKind === "trimester_empty") ||
            (view === "all" &&
              category != null &&
              !explorerFrise.loading &&
              explorerFrise.model.coverageStatus === "complete" &&
              explorerFrise.model.eventCountInWindow === 0)
          ) ? (
            <FriseRideTrack
              model={activeFrise.model}
              categoryLabel={trackLabel}
              totalCount={activeFrise.totalCount}
              favorites={favoriteIds as Set<string>}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={onOpenDetail}
              loadError={activeFrise.error}
              onRetry={
                view === "all" ? () => void explorerFrise.reload() : undefined
              }
              bannerError={favoriteError || removeError}
              countTone={countTone}
              temporalNav={
                showTrimesterNav
                  ? {
                      onToday: activeFrise.goToday,
                      onPrev: activeFrise.goPrev,
                      onNext: activeFrise.goNext,
                      canPrev: activeFrise.canPrev,
                      canNext: activeFrise.canNext,
                      loading: activeFrise.loading,
                    }
                  : null
              }
            />
          ) : null}
        </div>
      </div>

      {detail ? (
        <EventDetailModal
          event={detail.event}
          surface="explorer"
          returnFocusTo={detail.returnFocusTo}
          onClose={() => setDetail(null)}
        />
      ) : null}
      {removeConfirmation}
    </div>
  );
}
