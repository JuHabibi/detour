"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import { FriseDayPanel } from "@/features/frise/components/FriseDayPanel";
import { FriseLandscapeDecor } from "@/features/frise/components/FriseLandscapeDecor";
import { FrisePosterCard } from "@/features/frise/components/FrisePosterCard";
import { VintageBikeSvg } from "@/components/VintageBikeSvg";
import {
  EXPLORER_FRIEZE_DAY_PREVIEW,
  EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE,
  friseDayMoreLabel,
  friseDayTrackRestCount,
  sliceFriseDayPreview,
} from "@/features/frise/timeline/frise-day-preview";
import {
  FRISE_DAY_MARK_PT_CLASS,
  FRISE_TRACK_HEIGHT_CLASS,
  FRISE_TRACK_PB_CLASS,
} from "@/features/frise/landscape/frise-layout";
import {
  createFriseScrollSession,
  friseTrackGeometryKey,
  type FriseScrollOverlaySnapshot,
  type FriseScrollSession,
} from "@/features/frise/scroll/frise-scroll-session";
import {
  type ExplorerFriezeDayCluster,
  type ExplorerFriezeModel,
  type ExplorerFriezeQuietGap,
} from "@/features/frise/timeline/frise-timeline-model";
import { cn } from "@/lib/cn";

type FriseRideTrackProps = {
  model: ExplorerFriezeModel;
  categoryLabel: string;
  totalCount: number;
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
  /** Erreur de chargement (hors flux : affichée dans le cadre de la piste). */
  loadError?: string | null;
  onRetry?: () => void;
  /** Erreur favori ponctuelle — bandeau dans le cadre, sans pousser la piste. */
  bannerError?: string | null;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    queueMicrotask(sync);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function initialMonthLabel(model: ExplorerFriezeModel): string {
  return model.chapters[0]
    ? `${model.chapters[0].title} ${model.chapters[0].yearLabel}`
    : model.window.label;
}

export function FriseRideTrack({
  model,
  categoryLabel,
  totalCount: _totalCount,
  favorites,
  onToggleFavorite,
  onOpenDetail,
  loadError = null,
  onRetry,
  bannerError = null,
}: FriseRideTrackProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<FriseScrollSession | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isPending = model.coverageStatus === "pending";
  const isError = model.coverageStatus === "error";
  const showTrackBody = !isPending && !isError;
  const geometryKey = useMemo(() => friseTrackGeometryKey(model), [model]);
  const [overlay, setOverlay] = useState<FriseScrollOverlaySnapshot>(() => ({
    progress: 0,
    wheelAngle: 0,
    rolling: false,
    activeMonthLabel: initialMonthLabel(model),
    activeDetail: null,
  }));
  const [dayPanel, setDayPanel] = useState<{
    day: ExplorerFriezeDayCluster;
    returnFocusTo: HTMLElement | null;
  } | null>(null);

  // Trimestre / fenêtre : ferme le panneau sans réinitialiser le scroll horizontal.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDayPanel(null);
    });
    return () => {
      cancelled = true;
    };
  }, [model.window.fromKey, model.window.toKey, categoryLabel]);

  // Session durable : ne pas la reconstruire quand `model` est recréé (favori, etc.).
  useEffect(() => {
    const session = createFriseScrollSession({
      getScroller: () => scrollerRef.current,
      reducedMotion,
      initialMonthLabel: initialMonthLabel(model),
      onOverlay: setOverlay,
    });
    sessionRef.current = session;

    const el = scrollerRef.current;
    if (!el) {
      session.dispose();
      sessionRef.current = null;
      return;
    }

    session.invalidateMarks();
    el.addEventListener("scroll", session.onScroll, { passive: true });
    if (process.env.NODE_ENV !== "production") {
      (
        el as HTMLElement & { __friseScrollSession?: FriseScrollSession }
      ).__friseScrollSession = session;
    }

    const ro = new ResizeObserver(() => {
      session.invalidateMarks();
    });
    ro.observe(el);
    if (trackRef.current) ro.observe(trackRef.current);

    return () => {
      el.removeEventListener("scroll", session.onScroll);
      ro.disconnect();
      session.dispose();
      if (process.env.NODE_ENV !== "production") {
        delete (
          el as HTMLElement & { __friseScrollSession?: FriseScrollSession }
        ).__friseScrollSession;
      }
      if (sessionRef.current === session) sessionRef.current = null;
    };
    // `model` volontairement omis : géométrie gérée ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session lifetime ≠ model identity
  }, [reducedMotion]);

  useEffect(() => {
    sessionRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Recalcule les marqueurs seulement si leur position peut changer.
  useEffect(() => {
    sessionRef.current?.invalidateMarks();
  }, [geometryKey]);

  const scrollByStep = useCallback(
    (direction: -1 | 1) => {
      const el = scrollerRef.current;
      if (!el) return;
      const step = Math.max(220, Math.floor(el.clientWidth * 0.55));
      el.scrollBy({
        left: direction * step,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByStep(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByStep(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      scrollerRef.current?.scrollTo({
        left: 0,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    } else if (event.key === "End") {
      event.preventDefault();
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({
        left: el.scrollWidth,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }

  const openDayPanel = useCallback(
    (day: ExplorerFriezeDayCluster, trigger: HTMLElement) => {
      setDayPanel({ day, returnFocusTo: trigger });
    },
    [],
  );

  const eventSummary =
    model.coverageStatus === "pending"
      ? "La promenade se prépare…"
      : model.coverageStatus === "error"
        ? "Impossible d’afficher cette période."
        : model.eventCountInWindow === 0
          ? model.coverageStatus === "truncated"
            ? "Couverture incomplète : d’autres sorties peuvent exister sur cette période."
            : "Aucune sortie sur cette période."
          : model.eventCountInWindow === 1
            ? "1 sortie sur cette période."
            : `${model.eventCountInWindow} sorties sur cette période.`;
  const truncationNote =
    model.coverageStatus === "truncated" && model.eventCountInWindow > 0
      ? " Affichage partiel (plafond de sécurité)."
      : "";

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1 md:mb-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
            Promenade · {categoryLabel}
          </p>
          <p className="mt-1 font-editorial text-2xl leading-none tracking-tight text-ink md:text-3xl">
            {model.window.label}
          </p>
          <p
            className="mt-2 min-h-[2.75rem] text-sm leading-5 text-cream-dim md:min-h-10"
            data-frise-status-slot="period-summary"
            aria-live="polite"
          >
            {eventSummary}
            {truncationNote}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RideButton label="←" onClick={() => scrollByStep(-1)} />
          <RideButton label="→" onClick={() => scrollByStep(1)} />
        </div>
      </div>

      <p className="mb-3 text-[12px] text-sand md:mb-4">
        Faites glisser horizontalement, ou utilisez ← → (Début / Fin).
      </p>

      <div className="relative overflow-hidden border border-line bg-foam/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "url(/images/editorial/explorer-paper-texture.webp)",
            backgroundSize: "auto",
            backgroundPosition: "top left",
            backgroundRepeat: "repeat",
          }}
        />

        {bannerError ? (
          <div
            className="absolute inset-x-0 top-0 z-30 border-b border-coral/30 bg-paper/95 px-3 py-2 md:px-4"
            role="alert"
            data-frise-status-slot="favorite-error"
          >
            <p className="text-sm leading-5 text-coral">{bannerError}</p>
          </div>
        ) : null}

        {showTrackBody ? (
          <FriseScrollChrome overlay={overlay} reducedMotion={reducedMotion} />
        ) : (
          <div className="absolute inset-0 z-[5] flex items-center justify-center">
            <FriseTrackStatusLayer
              pending={isPending}
              errorMessage={
                loadError ??
                (isError ? "Impossible d’afficher cette période." : null)
              }
              onRetry={onRetry}
              reducedMotion={reducedMotion}
            />
          </div>
        )}

        <div
          ref={scrollerRef}
          role="region"
          aria-label={
            isPending
              ? `La promenade · ${categoryLabel}. Chargement de ${model.window.label}.`
              : isError
                ? `La promenade · ${categoryLabel}. Impossible d’afficher ${model.window.label}.`
                : `La promenade · ${categoryLabel}. Défilement horizontal. Mois affiché : ${overlay.activeMonthLabel}.`
          }
          aria-busy={isPending}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className={cn(
            "relative z-[1] flex snap-x snap-mandatory gap-0 overflow-y-hidden",
            showTrackBody ? "overflow-x-auto" : "overflow-x-hidden",
            "pt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
            "md:pt-8",
            "scrollbar-none",
            "touch-pan-x",
            !showTrackBody && "pointer-events-none",
          )}
        >
          <div
            ref={trackRef}
            data-frise-track-height="viewport"
            data-frise-track-state={
              isPending ? "pending" : isError ? "error" : "ready"
            }
            className={cn(
              "relative flex shrink-0",
              showTrackBody ? "w-max" : "w-full min-w-full",
              FRISE_TRACK_HEIGHT_CLASS,
              FRISE_TRACK_PB_CLASS,
            )}
          >
            {showTrackBody ? (
              <FriseTrackBody
                model={model}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onOpenDetail={onOpenDetail}
                onOpenDayPanel={openDayPanel}
              />
            ) : null}
          </div>
        </div>
      </div>

      {dayPanel ? (
        <FriseDayPanel
          day={dayPanel.day}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onOpenDetail={onOpenDetail}
          returnFocusTo={dayPanel.returnFocusTo}
          onClose={() => setDayPanel(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Pending / erreur : même hauteur de piste, pas d’anciennes cartes ni de faux mois.
 * Pas de décor paysage ici (évite d’élargir le track hors viewport).
 */
function FriseTrackStatusLayer({
  pending,
  errorMessage,
  onRetry,
  reducedMotion,
}: {
  pending: boolean;
  errorMessage: string | null;
  onRetry?: () => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
      {pending ? (
        <p
          className={cn(
            "font-editorial text-[1.35rem] leading-snug tracking-tight text-ink/80 md:text-2xl",
            !reducedMotion &&
              "animate-[frise-pending-fade_1.6s_ease-in-out_infinite]",
          )}
          data-frise-status-slot="pending-loader"
        >
          La promenade se prépare…
        </p>
      ) : (
        <div
          className="flex flex-col items-center gap-3"
          data-frise-status-slot="load-error"
        >
          <p className="text-sm leading-6 text-coral" role="alert">
            {errorMessage ?? "Impossible d’afficher cette période."}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-10 border border-line bg-paper px-4 text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink/30 hover:bg-foam motion-reduce:transition-none"
            >
              Réessayer
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Vélo + repère temporel — seuls à réagir au scroll. */
const FriseScrollChrome = memo(function FriseScrollChrome({
  overlay,
  reducedMotion,
}: {
  overlay: FriseScrollOverlaySnapshot;
  reducedMotion: boolean;
}) {
  const bikeTravel = reducedMotion
    ? 0.12
    : 0.08 + overlay.progress * 0.72;

  return (
    <>
      <div
        data-frise-time-chip
        className="pointer-events-none absolute left-3 top-2 z-[4] max-w-[min(12.5rem,66%)] border border-line/50 bg-paper/95 px-2 py-1 shadow-[2px_2px_0_rgb(17_17_17/0.04)] md:left-4 md:top-4 md:max-w-[min(14rem,70%)] md:px-2.5 md:py-1.5"
        aria-live="polite"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sand">
          Vous parcourez
        </p>
        <p className="mt-0.5 font-display text-[0.95rem] leading-tight tracking-tight text-ink">
          {overlay.activeMonthLabel}
        </p>
        {overlay.activeDetail &&
        overlay.activeDetail !== overlay.activeMonthLabel &&
        !overlay.activeDetail.startsWith("Respiration") ? (
          <p className="mt-0.5 hidden truncate text-[11px] text-cream-dim md:block">
            {overlay.activeDetail}
          </p>
        ) : null}
        <div
          aria-hidden
          className="mt-1.5 h-0.5 w-full overflow-hidden bg-ink/10"
        >
          <div
            className={cn(
              "h-full bg-ink/45",
              !reducedMotion && "transition-[width] duration-150 ease-out",
            )}
            style={{ width: `${Math.round(overlay.progress * 100)}%` }}
          />
        </div>
      </div>

      <div
        aria-hidden
        data-frise-road-over-decor="1"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[4.25rem] md:h-[5.75rem]"
      >
        <div className="absolute inset-x-0 bottom-0 h-[1.65rem] bg-paper/80 md:h-[2.1rem]" />
        <div className="absolute inset-x-0 bottom-[1.55rem] h-px bg-ink/30 md:bottom-[1.95rem]" />
        <div className="absolute inset-x-0 bottom-[1.45rem] h-px border-t border-dashed border-ink/25 md:bottom-[1.85rem]" />
        <div
          className={cn(
            "absolute bottom-1 will-change-transform md:bottom-2",
            !reducedMotion &&
              overlay.rolling &&
              "animate-[frise-bike-bob_0.28s_ease-in-out]",
          )}
          style={{
            left: `${(bikeTravel * 100).toFixed(2)}%`,
            transform: "translateX(-45%)",
          }}
        >
          <VintageBikeSvg
            wheelAngleDeg={reducedMotion ? 0 : overlay.wheelAngle}
            className="h-12 w-auto sm:h-14 md:h-[4.75rem]"
          />
        </div>
      </div>
    </>
  );
});

/**
 * Chapitres / cartes / décor — ne rerendent pas quand seul le chrome scroll change.
 */
export const FriseTrackBody = memo(function FriseTrackBody({
  model,
  favorites,
  onToggleFavorite,
  onOpenDetail,
  onOpenDayPanel,
}: {
  model: ExplorerFriezeModel;
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
  onOpenDayPanel: (
    day: ExplorerFriezeDayCluster,
    trigger: HTMLElement,
  ) => void;
}) {
  return (
    <>
      <FriseLandscapeDecor />

      <div className="relative z-[1] flex h-full items-start">
        <div className="w-[8vw] shrink-0 md:w-[6vw]" aria-hidden />

        {model.chapters.map((chapter) => {
          const monthLabel = `${chapter.title} ${chapter.yearLabel}`;
          return (
            <div
              key={chapter.id}
              className="flex h-full shrink-0 items-start"
            >
              <MonthMilestone
                title={chapter.title}
                year={chapter.yearLabel}
                monthKey={chapter.monthKey}
                monthLabel={monthLabel}
              />
              {chapter.items.map((item) =>
                item.kind === "quiet" ? (
                  <QuietStretch
                    key={item.id}
                    item={item}
                    monthKey={chapter.monthKey}
                    monthLabel={monthLabel}
                  />
                ) : (
                  <DayPoster
                    key={item.id}
                    item={item}
                    monthKey={chapter.monthKey}
                    monthLabel={monthLabel}
                    favorites={favorites}
                    onToggleFavorite={onToggleFavorite}
                    onOpenDetail={onOpenDetail}
                    onOpenDayPanel={onOpenDayPanel}
                  />
                ),
              )}
            </div>
          );
        })}

        <div className="w-[12vw] shrink-0 md:w-[10vw]" aria-hidden />
      </div>
    </>
  );
});

function RideButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 min-w-10 border border-line bg-paper px-3 text-sm text-ink transition-colors hover:border-ink/30 hover:bg-foam motion-reduce:transition-none"
    >
      {label}
    </button>
  );
}

function MonthMilestone({
  title,
  year,
  monthKey,
  monthLabel,
}: {
  title: string;
  year: string;
  monthKey: string;
  monthLabel: string;
}) {
  return (
    <div
      data-frise-mark={monthLabel}
      data-frise-month-key={monthKey}
      data-frise-month-label={monthLabel}
      className={cn(
        "relative flex w-[9.5rem] shrink-0 snap-start flex-col justify-start border-r border-line/40 px-3 md:w-[12rem] md:px-4",
        FRISE_DAY_MARK_PT_CLASS,
        "md:pt-24",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sand">
        {year}
      </p>
      <p className="mt-1 font-display text-[1.85rem] leading-[0.95] tracking-tight text-ink md:text-[2.35rem]">
        {title}
      </p>
      <span
        aria-hidden
        className="mt-5 inline-block h-7 w-px bg-coral/90 md:mt-6 md:h-9"
      />
    </div>
  );
}

function QuietStretch({
  item,
  monthKey,
  monthLabel,
}: {
  item: ExplorerFriezeQuietGap;
  monthKey: string;
  monthLabel: string;
}) {
  const width =
    item.dayCount <= 2
      ? "w-[4.5rem] md:w-[5.5rem]"
      : item.dayCount <= 7
        ? "w-[7rem] md:w-[9rem]"
        : "w-[10rem] md:w-[12.5rem]";

  return (
    <div
      data-frise-mark={item.label}
      data-frise-month-key={monthKey}
      data-frise-month-label={monthLabel}
      className={cn(
        "relative flex h-full shrink-0 snap-center flex-col items-center justify-start px-2",
        FRISE_DAY_MARK_PT_CLASS,
        width,
      )}
    >
      <p className="max-w-[9rem] text-center font-editorial text-sm italic leading-snug text-sand">
        {item.label}
      </p>
      <div
        aria-hidden
        className="mt-auto mb-6 h-px w-full bg-[repeating-linear-gradient(90deg,rgb(17_17_17/0.22)_0_5px,transparent_5px_11px)]"
      />
    </div>
  );
}

function DayPoster({
  item,
  monthKey,
  monthLabel,
  favorites,
  onToggleFavorite,
  onOpenDetail,
  onOpenDayPanel,
}: {
  item: ExplorerFriezeDayCluster;
  monthKey: string;
  monthLabel: string;
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
  onOpenDayPanel: (
    day: ExplorerFriezeDayCluster,
    trigger: HTMLElement,
  ) => void;
}) {
  const mark = `${item.weekdayLabel} ${item.dayNumber} ${item.monthShort}`;
  // Plafond desktop : mobile n’affiche que la 1ʳᵉ carte (CSS), panneau pour le reste.
  const preview = sliceFriseDayPreview(
    item.events,
    EXPLORER_FRIEZE_DAY_PREVIEW,
  );
  const mobileRest = friseDayTrackRestCount(
    preview.total,
    EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE,
  );
  const desktopRest = friseDayTrackRestCount(
    preview.total,
    EXPLORER_FRIEZE_DAY_PREVIEW,
  );
  const mobileMoreLabel = friseDayMoreLabel(mobileRest);
  const desktopMoreLabel = friseDayMoreLabel(desktopRest);

  return (
    <div
      data-frise-mark={mark}
      data-frise-month-key={monthKey}
      data-frise-month-label={monthLabel}
      data-frise-day-total={preview.total}
      data-frise-day-visible={preview.visible.length}
      data-frise-day-visible-mobile={Math.min(
        preview.total,
        EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE,
      )}
      className={cn(
        "relative flex w-[18.5rem] shrink-0 snap-center flex-col border-r border-line/40 px-3 md:w-[21rem] md:px-4",
        FRISE_DAY_MARK_PT_CLASS,
      )}
    >
      <div className="mb-3 flex items-baseline gap-2 md:mb-5">
        <p className="font-editorial text-[2rem] leading-none tracking-tight text-coral md:text-[2.35rem]">
          {item.dayNumber}
        </p>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
            {item.weekdayLabel}
          </p>
          <p className="text-[11px] uppercase tracking-[0.08em] text-cream-dim">
            {item.monthShort}
          </p>
        </div>
        {preview.total > 2 ? (
          <p className="ml-auto self-center text-[10px] font-medium uppercase tracking-[0.12em] text-sand">
            {preview.total} sorties
          </p>
        ) : null}
      </div>

      <ul className="mt-1 flex min-h-0 flex-col gap-3">
        {preview.visible.map((event, index) => (
          <FrisePosterCard
            key={event.id}
            event={event}
            trackCompact
            isFavorite={favorites?.has(event.id) ?? false}
            onToggleFavorite={onToggleFavorite}
            onOpenDetail={onOpenDetail}
            as="li"
            className={
              index >= EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE
                ? "hidden md:block"
                : undefined
            }
          />
        ))}
      </ul>

      {mobileRest > 0 ? (
        <button
          type="button"
          className="mt-3 self-start bg-paper/90 px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink underline decoration-mint/80 decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:hidden"
          aria-haspopup="dialog"
          data-frise-day-more="mobile"
          onClick={(e) => onOpenDayPanel(item, e.currentTarget)}
        >
          {mobileMoreLabel}
        </button>
      ) : null}

      {desktopRest > 0 ? (
        <button
          type="button"
          className="mt-3 hidden self-start bg-paper/90 px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink underline decoration-mint/80 decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:inline"
          aria-haspopup="dialog"
          data-frise-day-more="desktop"
          onClick={(e) => onOpenDayPanel(item, e.currentTarget)}
        >
          {desktopMoreLabel}
        </button>
      ) : null}
    </div>
  );
}
