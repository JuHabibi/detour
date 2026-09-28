"use client";

import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { resolveCategoryBadgeTone } from "@/components/event/category-badge-style";
import { formatWhen } from "@/components/event/format-when";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { cn } from "@/lib/cn";


type FrisePosterCardProps = {
  event: EventItem;
  isFavorite: boolean;
  onToggleFavorite?: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
  /** Variante un peu plus compacte (liste panneau). */
  dense?: boolean;
  /**
   * Compactage + clamps titre/lieu — piste mobile uniquement
   * (`max-md`). Desktop et panneau gardent le texte complet.
   */
  trackCompact?: boolean;
  as?: "li" | "div";
  className?: string;
};

export function FrisePosterCard({
  event,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
  dense = false,
  trackCompact = false,
  as = "li",
  className,
}: FrisePosterCardProps) {
  const categoryLabel = resolveCategoryBadgeLabel(event);
  const whenLabel = formatWhen(event);
  const interactive = Boolean(onOpenDetail);
  const place =
    [event.venue?.trim(), event.city?.trim()].filter(Boolean).join(" · ") ||
    "Lieu à préciser";

  const Wrapper = as;

  return (
    <Wrapper className={cn("w-full", className)}>
      <div className="relative">
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(event.id);
            }}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? `Retirer « ${event.title} » des favoris`
                : `Ajouter « ${event.title} » aux favoris`
            }
            className={cn(
              "absolute right-2 top-2 z-[2] flex size-9 items-center justify-center border text-ink",
              isFavorite
                ? "border-coral/50 bg-blush-soft text-coral"
                : "border-ink/20 bg-paper text-ink hover:border-coral/40 hover:text-coral",
              "transition-colors motion-reduce:transition-none",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            )}
          >
            <HeartIcon filled={isFavorite} />
          </button>
        ) : null}
        <button
          type="button"
          disabled={!interactive}
          data-event-detail-trigger={event.id}
          onClick={(e) => {
            if (!onOpenDetail) return;
            onOpenDetail(event, "explorer", e.currentTarget);
          }}
          className={cn(
            "group flex w-full flex-col border border-ink/15 bg-paper text-left shadow-[3px_3px_0_rgb(17_17_17/0.06)]",
            dense ? "gap-1 px-3 py-3 pr-12" : "gap-1.5 px-3.5 py-3.5 pr-12",
            trackCompact && "max-md:gap-0.5 max-md:px-2.5 max-md:py-2.5 max-md:pr-11",
            "transition-colors hover:border-ink/30 hover:bg-foam",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            "disabled:cursor-default",
            "motion-reduce:transition-none",
          )}
        >
          <span
            className={cn(
              "inline-block max-w-[calc(100%-0.5rem)] truncate px-1.5 py-0.5",
              "text-[9px] font-medium uppercase tracking-[0.12em]",
              resolveCategoryBadgeTone(event.category),
            )}
          >
            {categoryLabel}
          </span>
          {event.endAt && event.startAt && event.startAt !== event.endAt ? (
            <span className="text-[10px] uppercase tracking-[0.08em] text-sand">
              Sur plusieurs jours
            </span>
          ) : null}
          <p
            className={cn(
              "font-display font-semibold leading-[1.18] tracking-tight text-ink",
              dense ? "text-[1.05rem]" : "text-[1.1rem] md:text-[1.2rem]",
              trackCompact && "max-md:line-clamp-3",
            )}
          >
            {event.title}
          </p>
          <p
            className={cn(
              "text-[12px] leading-snug text-ink/80",
              trackCompact && "max-md:line-clamp-2",
            )}
          >
            {place}
          </p>
          <p className="text-[12px] font-medium tabular-nums text-sand">
            {whenLabel}
          </p>
        </button>
      </div>
    </Wrapper>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7.2-4.4-9.2-8.6C1.2 8.2 3 5 6.4 5c2 0 3.3 1.1 3.6 1.5C10.3 6.1 11.6 5 13.6 5 17 5 18.8 8.2 17.2 11.4 15.2 15.6 12 20 12 20Z"
        className={cn(filled ? "fill-coral stroke-coral" : "stroke-current")}
        strokeWidth="1.6"
      />
    </svg>
  );
}
