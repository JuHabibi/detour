"use client";

import { useEffect, useId, useRef } from "react";
import type { OpenEventDetailHandler } from "@/features/home/components/EventCard";
import { FrisePosterCard } from "@/features/frise/components/FrisePosterCard";
import type { ExplorerFriezeDayCluster } from "@/features/frise/timeline/frise-timeline-model";
import { cn } from "@/lib/cn";

type FriseDayPanelProps = {
  day: ExplorerFriezeDayCluster;
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
};

/**
 * Panneau jour chargé — latéral desktop, plein largeur mobile.
 * Motif a11y aligné sur EventDetailModal (Escape, focus, overlay).
 */
export function FriseDayPanel({
  day,
  favorites,
  onToggleFavorite,
  onOpenDetail,
  onClose,
  returnFocusTo,
}: FriseDayPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusToRef = useRef(returnFocusTo);
  onCloseRef.current = onClose;
  returnFocusToRef.current = returnFocusTo;
  const dateLine = `${day.weekdayLabel} ${day.dayNumber} ${day.monthShort}`;
  const countLabel =
    day.events.length === 1
      ? "1 événement"
      : `${day.events.length} événements`;

  // Montage seul : un onClose inline du parent ne doit pas re-voler le focus
  // quand une fiche s’ouvre/ferme au-dessus.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Fiche au-dessus : laisser EventDetailModal consommer Escape seul.
      if (document.querySelector('[data-testid="event-detail-modal"]')) return;
      e.preventDefault();
      onCloseRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      const el = returnFocusToRef.current;
      if (el && typeof el.focus === "function" && document.contains(el)) {
        el.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch"
      data-testid="frise-day-panel-root"
    >
      <button
        type="button"
        aria-label="Fermer le panneau"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="frise-day-panel"
        className={cn(
          "relative z-[1] flex w-full flex-col border border-line bg-foam shadow-[-4px_0_0_rgb(17_17_17/0.04)]",
          "max-h-[min(88vh,40rem)] md:max-h-none md:h-full md:w-[min(26rem,92vw)]",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line/60 px-4 py-4 md:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
              Journée
            </p>
            <h2
              id={titleId}
              className="mt-1 font-display text-xl leading-tight tracking-tight text-ink md:text-2xl"
            >
              {dateLine}
            </h2>
            <p className="mt-1 text-sm text-cream-dim">{countLabel}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau du jour"
            className="flex size-9 shrink-0 items-center justify-center border border-line bg-paper text-sand transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
          {day.events.map((event) => (
            <FrisePosterCard
              key={event.id}
              event={event}
              dense
              as="li"
              isFavorite={favorites?.has(event.id) ?? false}
              onToggleFavorite={onToggleFavorite}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
