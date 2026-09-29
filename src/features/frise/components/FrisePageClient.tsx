"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFavorite,
  listMyFavoriteEventIds,
  listMyFavoriteEvents,
  removeFavorite,
} from "@/app/actions/favorites";
import {
  getMyCarnetEvents,
  listMyCarnetsState,
} from "@/app/actions/groups";
import type { GroupSummary } from "@/application/groups";
import { categories } from "@/config/event-categories";
import type { CategoryId, EventItem } from "@/data/types";
import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/features/account/components/PendingFavoriteAfterAuthGate";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { CategoryFilter } from "@/features/home/components/explorer/CategoryFilter";
import { FriseEmptyState } from "@/features/frise/components/FriseEmptyState";
import { FriseCarnetThumbs } from "@/features/frise/components/FriseCarnetThumbs";
import { FriseViewNav } from "@/features/frise/components/FriseViewNav";
import { FriseRideTrack } from "@/features/frise/components/FriseRideTrack";
import {
  buildFriseHref,
  type FriseView,
} from "@/features/frise/frise-url-state";
import { useFriseEvents } from "@/features/frise/hooks/useFriseEvents";
import { useFrisePersonalEvents } from "@/features/frise/hooks/useFrisePersonalEvents";
import { cn } from "@/lib/cn";
import type { DetourCategory } from "@/domain/events/classify-event-category";

const RIDE_CATEGORIES = categories.filter(
  (c): c is { id: DetourCategory; label: string } => c.id !== "tout",
);

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();
const EMPTY_EVENTS: EventItem[] = [];

type FrisePageClientProps = {
  initialView: FriseView;
  initialCategory: CategoryId | null;
  initialNotebookId: string | null;
  user?: { name: string; email: string } | null;
};

type FavoriteState = {
  userId: string;
  ids: Set<string>;
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
  const [detail, setDetail] = useState<{
    event: EventItem;
    returnFocusTo: HTMLElement | null;
  } | null>(null);

  const [favoriteState, setFavoriteState] = useState<FavoriteState | null>(
    null,
  );
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [favoriteEvents, setFavoriteEvents] = useState<EventItem[]>([]);
  const [favoriteEventsLoading, setFavoriteEventsLoading] = useState(false);
  const [favoriteEventsError, setFavoriteEventsError] = useState<string | null>(
    null,
  );

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [notebookEvents, setNotebookEvents] = useState<EventItem[]>([]);
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    void listMyFavoriteEventIds().then((result) => {
      if (cancelled) return;
      setFavoriteState({
        userId: "self",
        ids: new Set(result.ok ? result.eventIds : []),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== "favorites") return;
    let cancelled = false;
    setFavoriteEventsLoading(true);
    setFavoriteEventsError(null);
    void listMyFavoriteEvents().then((result) => {
      if (cancelled) return;
      setFavoriteEventsLoading(false);
      if (!result.ok) {
        setFavoriteEvents([]);
        setFavoriteEventsError("Impossible de charger vos favoris.");
        return;
      }
      setFavoriteEvents(result.events);
      setFavoriteState({
        userId: "self",
        ids: new Set(result.events.map((e) => e.id)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== "notebook") return;
    let cancelled = false;
    setGroupsLoading(true);
    void listMyCarnetsState().then((result) => {
      if (cancelled) return;
      setGroupsLoading(false);
      if (!result.ok) {
        setGroups([]);
        return;
      }
      setGroups(result.groups);
      if (
        notebookId &&
        !result.groups.some((group) => group.id === notebookId)
      ) {
        setNotebookId(null);
        replaceUrl({ view: "notebook", category, notebookId: null });
      } else if (!notebookId && result.groups.length === 1) {
        const only = result.groups[0]!;
        setNotebookId(only.id);
        replaceUrl({ view: "notebook", category, notebookId: only.id });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on view entry
  }, [view]);

  useEffect(() => {
    if (view !== "notebook" || !notebookId) {
      setNotebookEvents([]);
      setNotebookName(null);
      setNotebookError(null);
      return;
    }
    let cancelled = false;
    setNotebookLoading(true);
    setNotebookError(null);
    void getMyCarnetEvents(notebookId).then((result) => {
      if (cancelled) return;
      setNotebookLoading(false);
      if (!result.ok) {
        setNotebookEvents([]);
        setNotebookName(null);
        setNotebookError(
          result.reason === "not_found"
            ? "Ce carnet est introuvable."
            : "Impossible de charger ce carnet.",
        );
        if (result.reason === "not_found") {
          setNotebookId(null);
          replaceUrl({ view: "notebook", category, notebookId: null });
        }
        return;
      }
      setNotebookEvents(result.events);
      setNotebookName(result.group.name);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notebook fetch
  }, [view, notebookId]);

  const favorites: ReadonlySet<string> = favoriteState?.ids ?? EMPTY_FAVORITES;

  function patchFavorites(mutator: (draft: Set<string>) => void) {
    setFavoriteState((prev) => {
      const draft = prev ? new Set(prev.ids) : new Set<string>();
      mutator(draft);
      return { userId: prev?.userId ?? "self", ids: draft };
    });
  }

  function toggleFavorite(id: string) {
    setFavoriteError(null);
    const wasFavorite = favorites.has(id);
    const removedFavoriteIndex = wasFavorite
      ? favoriteEvents.findIndex((event) => event.id === id)
      : -1;
    const removedFavoriteEvent =
      removedFavoriteIndex >= 0
        ? favoriteEvents[removedFavoriteIndex]
        : undefined;

    patchFavorites((draft) => {
      if (wasFavorite) draft.delete(id);
      else draft.add(id);
    });
    if (wasFavorite) {
      setFavoriteEvents((prev) => prev.filter((event) => event.id !== id));
    }

    /** Rejeu de l’état d’origine depuis l’état courant — autres toggles préservés. */
    function rollback() {
      patchFavorites((draft) => {
        if (wasFavorite) draft.add(id);
        else draft.delete(id);
      });
      if (removedFavoriteEvent) {
        setFavoriteEvents((current) => {
          if (current.some((event) => event.id === id)) return current;
          const restored = [...current];
          restored.splice(
            Math.min(removedFavoriteIndex, restored.length),
            0,
            removedFavoriteEvent,
          );
          return restored;
        });
      }
      setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
    }

    startTransition(async () => {
      try {
        const result = wasFavorite
          ? await removeFavorite(id)
          : await addFavorite(id);
        if (result.ok) return;
      } catch (error) {
        console.error("[detour:frise] toggleFavorite failed", error);
      }
      rollback();
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

  function replaceUrl(next: {
    view: FriseView;
    category: CategoryId | null;
    notebookId: string | null;
  }) {
    const href = buildFriseHref({
      view: next.view,
      category: next.category,
      notebookId: next.notebookId,
      preview: readPreviewFlag(),
    });
    router.replace(href, { scroll: false });
  }

  function selectView(next: FriseView) {
    setView(next);
    let nextCategory: CategoryId | null =
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

  const backHref = useMemo(() => "/#explorer", []);
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
      setFavoriteState({ userId: "self", ids: new Set(ids) });
      setFavoriteError(null);
    };
    return () => {
      delete w.__friseSetFavoriteIds;
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={favorites.size}
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
              ctaHref="/#explorer"
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
              favorites={favorites as Set<string>}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={onOpenDetail}
              loadError={activeFrise.error}
              onRetry={
                view === "all" ? () => void explorerFrise.reload() : undefined
              }
              bannerError={favoriteError}
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
    </div>
  );
}
