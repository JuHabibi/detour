"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { OpenEventDetailHandler } from "@/features/home/components/EventCard";
import { FriseDayPanel } from "@/features/frise/components/FriseDayPanel";
import { FriseLandscapeDecor } from "@/features/frise/components/FriseLandscapeDecor";
import { FrisePosterCard } from "@/features/frise/components/FrisePosterCard";
import { VintageBikeSvg } from "@/features/frise/components/VintageBikeSvg";
import {
  friseDayMoreLabel,
  sliceFriseDayPreview,
} from "@/features/frise/frise-day-preview";
import {
  FRISE_TRACK_HEIGHT_CLASS,
  FRISE_TRACK_PB_CLASS,
} from "@/features/frise/frise-layout";
import {
  friseScrollProgress,
  resolveActiveFriseMark,
  type FriseScrollMark,
} from "@/features/frise/frise-scroll-mark";
import {
  type ExplorerFriezeDayCluster,
  type ExplorerFriezeModel,
  type ExplorerFriezeQuietGap,
} from "@/features/frise/frise-timeline-model";
import { cn } from "@/lib/cn";

type FriseRideTrackProps = {
  model: ExplorerFriezeModel;
  categoryLabel: string;
  totalCount: number;
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function readScrollMarks(scroller: HTMLElement): FriseScrollMark[] {
  const scrollerRect = scroller.getBoundingClientRect();
  const nodes = scroller.querySelectorAll<HTMLElement>("[data-frise-mark]");
  const marks: FriseScrollMark[] = [];
  nodes.forEach((node) => {
    const monthKey = node.dataset.friseMonthKey?.trim() ?? "";
    const monthLabel = node.dataset.friseMonthLabel?.trim() ?? "";
    if (!monthKey || !monthLabel) return;
    const rect = node.getBoundingClientRect();
    const offsetLeft = rect.left - scrollerRect.left + scroller.scrollLeft;
    marks.push({
      offsetLeft,
      offsetWidth: Math.max(1, rect.width),
      monthKey,
      monthLabel,
      detailLabel: node.dataset.friseMark?.trim() || undefined,
    });
  });
  return marks;
}

export function FriseRideTrack({
  model,
  categoryLabel,
  totalCount: _totalCount,
  favorites,
  onToggleFavorite,
  onOpenDetail,
}: FriseRideTrackProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastScrollLeft = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [activeMonthLabel, setActiveMonthLabel] = useState(
    () =>
      model.chapters[0]
        ? `${model.chapters[0].title} ${model.chapters[0].yearLabel}`
        : model.window.label,
  );
  const [activeDetail, setActiveDetail] = useState<string | null>(null);
  const [dayPanel, setDayPanel] = useState<{
    day: ExplorerFriezeDayCluster;
    returnFocusTo: HTMLElement | null;
  } | null>(null);
  const rollTimeout = useRef<number | null>(null);

  // Trimestre / fenêtre : ferme le panneau sans réinitialiser le scroll horizontal.
  useEffect(() => {
    setDayPanel(null);
  }, [model.window.fromKey, model.window.toKey, categoryLabel]);

  const syncFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const nextProgress = friseScrollProgress(
      left,
      el.scrollWidth,
      el.clientWidth,
    );
    setProgress(nextProgress);

    if (!reducedMotion) {
      const delta = left - lastScrollLeft.current;
      setWheelAngle((angle) => angle + delta * 0.55);
      if (Math.abs(delta) > 0.5) {
        setRolling(true);
        if (rollTimeout.current) window.clearTimeout(rollTimeout.current);
        rollTimeout.current = window.setTimeout(() => setRolling(false), 140);
      }
    }
    lastScrollLeft.current = left;

    const active = resolveActiveFriseMark(
      readScrollMarks(el),
      left,
      el.clientWidth,
    );
    if (active) {
      setActiveMonthLabel(active.monthLabel);
      setActiveDetail(active.detailLabel);
    }
  }, [reducedMotion]);

  useEffect(() => {
    return () => {
      if (rollTimeout.current) window.clearTimeout(rollTimeout.current);
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncFromScroll();
    el.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll);
    return () => {
      el.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
    };
  }, [syncFromScroll, model]);

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

  const bikeTravel = reducedMotion ? 0.12 : 0.08 + progress * 0.72;
  const eventSummary =
    model.eventCountInWindow === 0
      ? "Aucune sortie sur cette période."
      : model.eventCountInWindow === 1
        ? "1 sortie sur cette période."
        : `${model.eventCountInWindow} sorties sur cette période.`;

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
          <p className="mt-2 text-sm text-cream-dim">{eventSummary}</p>
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
        {/* Texture papier — matière commune (tuile native, pas cover) */}
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

        {/* Repère temporel discret — sync scroll / dates, hors vélo */}
        <div
          data-frise-time-chip
          className="pointer-events-none absolute left-3 top-3 z-[4] max-w-[min(14rem,70%)] border border-line/50 bg-paper/95 px-2.5 py-1.5 shadow-[2px_2px_0_rgb(17_17_17/0.04)] md:left-4 md:top-4"
          aria-live="polite"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sand">
            Vous parcourez
          </p>
          <p className="mt-0.5 font-display text-[0.95rem] leading-tight tracking-tight text-ink">
            {activeMonthLabel}
          </p>
          {activeDetail &&
          activeDetail !== activeMonthLabel &&
          !activeDetail.startsWith("Respiration") ? (
            <p className="mt-0.5 truncate text-[11px] text-cream-dim">
              {activeDetail}
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
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Route + vélo — au-dessus du décor (test bande route) */}
        <div
          aria-hidden
          data-frise-road-over-decor="1"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[4.25rem] md:h-[5.75rem]"
        >
          {/* Bande de route : passe par-dessus la frise sous le vélo */}
          <div className="absolute inset-x-0 bottom-0 h-[1.65rem] bg-paper/80 md:h-[2.1rem]" />
          <div className="absolute inset-x-0 bottom-[1.55rem] h-px bg-ink/30 md:bottom-[1.95rem]" />
          <div className="absolute inset-x-0 bottom-[1.45rem] h-px border-t border-dashed border-ink/25 md:bottom-[1.85rem]" />
          <div
            className={cn(
              "absolute bottom-1 will-change-transform md:bottom-2",
              !reducedMotion &&
                rolling &&
                "animate-[frise-bike-bob_0.28s_ease-in-out]",
            )}
            style={{
              left: `${(bikeTravel * 100).toFixed(2)}%`,
              transform: "translateX(-45%)",
            }}
          >
            <VintageBikeSvg
              wheelAngleDeg={reducedMotion ? 0 : wheelAngle}
              className="h-12 w-auto sm:h-14 md:h-[4.75rem]"
            />
          </div>
        </div>

        <div
          ref={scrollerRef}
          role="region"
          aria-label={`La promenade · ${categoryLabel}. Défilement horizontal. Mois affiché : ${activeMonthLabel}.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className={cn(
            "relative z-[1] flex snap-x snap-mandatory gap-0 overflow-x-auto overflow-y-hidden",
            // Respiration haute (pastille) — padding vélo dans la piste
            "pt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
            "md:pt-8",
            "scrollbar-none",
            "touch-pan-x",
          )}
        >
          {/* Piste viewport (~650–750px desktop) : hauteur ≠ densité événements */}
          <div
            data-frise-track-height="viewport"
            className={cn(
              "relative flex w-max shrink-0",
              FRISE_TRACK_HEIGHT_CLASS,
              FRISE_TRACK_PB_CLASS,
            )}
          >
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
                          onOpenDayPanel={(day, trigger) =>
                            setDayPanel({ day, returnFocusTo: trigger })
                          }
                        />
                      ),
                    )}
                  </div>
                );
              })}

              <div className="w-[12vw] shrink-0 md:w-[10vw]" aria-hidden />
            </div>
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
      className="relative flex w-[9.5rem] shrink-0 snap-start flex-col justify-start border-r border-line/40 px-3 pt-20 md:w-[12rem] md:px-4 md:pt-24"
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
        width,
      )}
    >
      <p className="mt-1 max-w-[9rem] text-center font-editorial text-sm italic leading-snug text-sand">
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
  const preview = sliceFriseDayPreview(item.events);
  const moreLabel = friseDayMoreLabel(preview.restCount);

  return (
    <div
      data-frise-mark={mark}
      data-frise-month-key={monthKey}
      data-frise-month-label={monthLabel}
      data-frise-day-total={preview.total}
      data-frise-day-visible={preview.visible.length}
      className="relative flex w-[18.5rem] shrink-0 snap-center flex-col border-r border-line/40 px-3 pt-2 md:w-[21rem] md:px-4"
    >
      <div className="mb-4 flex items-baseline gap-2 md:mb-5">
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

      {/* Zone cartes plafonnée : 2 niveaux max, empilement vertical uniquement */}
      <ul className="mt-1 flex flex-col gap-3">
        {preview.visible.map((event) => (
          <FrisePosterCard
            key={event.id}
            event={event}
            isFavorite={favorites?.has(event.id) ?? false}
            onToggleFavorite={onToggleFavorite}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </ul>

      {preview.restCount > 0 ? (
        <button
          type="button"
          className="mt-3 self-start text-[11px] font-medium uppercase tracking-[0.12em] text-ink underline decoration-mint/80 decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-haspopup="dialog"
          onClick={(e) => onOpenDayPanel(item, e.currentTarget)}
        >
          {moreLabel}
        </button>
      ) : null}
    </div>
  );
}
