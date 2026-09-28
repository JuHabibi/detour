"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFavorite,
  listMyFavoriteEventIds,
  removeFavorite,
} from "@/app/actions/favorites";
import { categories } from "@/config/event-categories";
import type { EventItem } from "@/data/types";
import { Header } from "@/components/layout/Header";
import { EventDetailModal } from "@/features/home/components/EventDetailModal";
import { FriseRideTrack } from "@/features/frise/components/FriseRideTrack";
import { useFriseEvents } from "@/features/frise/useFriseEvents";
import { cn } from "@/lib/cn";
import type { DetourCategory } from "@/domain/events/classify-event-category";

const RIDE_CATEGORIES = categories.filter(
  (c): c is { id: DetourCategory; label: string } => c.id !== "tout",
);

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();

type FrisePageClientProps = {
  initialCategory: DetourCategory | null;
};

type FavoriteState = {
  userId: string;
  ids: Set<string>;
};

export function FrisePageClient({ initialCategory }: FrisePageClientProps) {
  const router = useRouter();
  const [category, setCategory] = useState<DetourCategory | null>(
    initialCategory,
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
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listMyFavoriteEventIds().then((result) => {
      if (cancelled) return;
      const ids = new Set(result.ok ? result.eventIds : []);
      setFavoriteState({
        userId: "self",
        ids,
      });
      setFavoritesHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    patchFavorites((draft) => {
      if (wasFavorite) draft.delete(id);
      else draft.add(id);
    });

    startTransition(async () => {
      const result = wasFavorite
        ? await removeFavorite(id)
        : await addFavorite(id);

      if (result.ok) return;

      patchFavorites((draft) => {
        if (wasFavorite) draft.add(id);
        else draft.delete(id);
      });

      setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
    });
  }

  const enabled = category != null;
  const frise = useFriseEvents({
    category: category ?? "Musique",
    city: null,
    search: "",
    enabled,
  });

  const categoryLabel =
    RIDE_CATEGORIES.find((c) => c.id === category)?.label ?? "Catégorie";

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

  function selectCategory(next: DetourCategory) {
    setCategory(next);
    const params = new URLSearchParams();
    params.set("category", next);
    // Conserve preview=1 en local pour ne pas perdre le bypass auth QA.
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1"
    ) {
      params.set("preview", "1");
    }
    router.replace(`/frise?${params.toString()}`, {
      scroll: false,
    });
  }

  const backHref = useMemo(() => "/#explorer", []);
  const showEmptyFavorites =
    favoritesHydrated && favorites.size === 0 && enabled;
  /** Réserve la hauteur du bandeau avant hydratation pour ne pas pousser la piste. */
  const reserveEmptyFavoritesSlot =
    enabled && (!favoritesHydrated || favorites.size === 0);

  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={favorites.size}
        homeHref="/"
        accountHref="/account"
        accountLabel="Mon compte"
        showFriseNav
      />

      <div className="detour-decor detour-decor--explorer relative overflow-x-clip">
        <div className="relative z-[1] mx-auto max-w-[var(--detour-shell-max)] px-5 pb-16 pt-8 md:px-10 md:pb-20 md:pt-10 lg:px-16 2xl:px-20">
          <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <Link
                href={backHref}
                className="inline-flex min-h-10 items-center text-[12px] font-medium uppercase tracking-[0.14em] text-sand underline decoration-mint/70 decoration-2 underline-offset-4 transition-colors hover:text-ink motion-reduce:transition-none"
              >
                ← Retour à Explorer
              </Link>
              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
                La promenade
              </p>
              <h1 className="mt-2 max-w-[16ch] font-display text-[2.15rem] leading-[1.02] tracking-tight text-ink md:text-[3rem]">
                Prenez le temps de faire un détour.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-cream-dim md:text-[15px]">
                Choisissez ce qui vous fait envie, remontez le fil des prochaines
                semaines et gardez vos découvertes de côté.
              </p>
            </div>
          </div>

          <div
            className="mb-4 min-h-5"
            aria-live="assertive"
            data-frise-status-slot="favorite-error"
          >
            {favoriteError ? (
              <p className="text-sm text-coral" role="alert">
                {favoriteError}
              </p>
            ) : null}
          </div>

          {reserveEmptyFavoritesSlot ? (
            <div
              className="mb-6 min-h-[8.875rem] md:min-h-[7.375rem]"
              aria-live="polite"
              data-frise-status-slot="empty-favorites"
            >
              {showEmptyFavorites ? (
                <div className="border border-line bg-foam px-4 py-4 md:px-5">
                  <p className="font-editorial text-xl leading-snug text-ink">
                    Aucun favori pour l’instant.
                  </p>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-cream-dim">
                    Parcourez la promenade et touchez le cœur sur une sortie qui
                    vous parle — vos détours apparaîtront aussi dans{" "}
                    <Link
                      href="/account"
                      className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4"
                    >
                      Mon compte
                    </Link>
                    .
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-6 md:mb-8">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
              Choisir une catégorie
            </p>
            <div
              role="group"
              aria-label="Catégorie de la promenade"
              className="scrollbar-none -mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            >
              {RIDE_CATEGORIES.map((item) => {
                const active = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectCategory(item.id)}
                    className={cn(
                      "h-9 shrink-0 px-3 text-[13px] transition-colors motion-reduce:transition-none",
                      active
                        ? "bg-ink text-foam"
                        : "bg-foam text-cream-dim hover:bg-mint-soft hover:text-ink",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {!category ? (
            <p className="max-w-md font-editorial text-2xl leading-snug text-ink">
              Choisissez une catégorie pour lancer la promenade.
            </p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={frise.goToday}
                  className="min-h-10 border border-line bg-foam px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink"
                >
                  Maintenant
                </button>
                <button
                  type="button"
                  disabled={!frise.canPrev}
                  onClick={frise.goPrev}
                  className="min-h-10 border border-line bg-foam px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink disabled:opacity-40"
                >
                  ← Trimestre
                </button>
                <button
                  type="button"
                  disabled={!frise.canNext}
                  onClick={frise.goNext}
                  className="min-h-10 border border-line bg-foam px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink disabled:opacity-40"
                >
                  Trimestre →
                </button>
                <span
                  className={cn(
                    "min-w-[6.5rem] text-sm text-sand",
                    !frise.loading && "invisible",
                  )}
                  aria-live="polite"
                  aria-hidden={!frise.loading}
                  data-frise-status-slot="loading"
                >
                  Chargement…
                </span>
              </div>

              <div
                className="mb-4 min-h-5"
                aria-live="assertive"
                data-frise-status-slot="load-error"
              >
                {frise.error ? (
                  <p className="text-sm text-coral" role="alert">
                    {frise.error}{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void frise.reload()}
                    >
                      Réessayer
                    </button>
                  </p>
                ) : null}
              </div>

              <FriseRideTrack
                model={frise.model}
                categoryLabel={categoryLabel}
                totalCount={frise.totalCount}
                favorites={favorites as Set<string>}
                onToggleFavorite={toggleFavorite}
                onOpenDetail={onOpenDetail}
              />
            </>
          )}
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
