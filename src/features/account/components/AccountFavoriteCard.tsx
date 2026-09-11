import Image from "next/image";
import type { EventItem } from "@/data/types";
import { resolveCategoryBadgeTone } from "@/features/home/category-badge-style";
import { cn } from "@/lib/cn";

type AccountFavoriteCardProps = {
  event: EventItem;
  /** Maquette : handlers no-op / toast UI local. */
  onRemove?: (id: string) => void;
  onAddToAgenda?: (id: string) => void;
};

/**
 * Card favori Account — même hiérarchie visuelle Explorer
 * (catégorie → titre → lieu → date), densité liste.
 * Pas d’import d’EventCard (feature-first).
 */
export function AccountFavoriteCard({
  event,
  onRemove,
  onAddToAgenda,
}: AccountFavoriteCardProps) {
  const whenLabel = event.time
    ? `${event.dateLabel} · ${event.time}`
    : event.dateLabel;
  const categoryLabel =
    event.genre?.trim() ||
    (event.category === "tout" ? "Autre" : event.category);

  return (
    <article className="group relative flex gap-4 border-b border-line py-5 md:gap-5 md:py-6">
      {event.image ? (
        <div className="relative aspect-[3/4] w-[5.5rem] shrink-0 overflow-hidden bg-ink-3 sm:w-[6.5rem]">
          <Image
            src={event.image}
            alt=""
            fill
            sizes="104px"
            className="object-cover object-center"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="aspect-[3/4] w-[5.5rem] shrink-0 bg-mint-soft/80 sm:w-[6.5rem]"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "inline-block max-w-full self-start truncate px-2 py-1",
            "text-[11px] font-medium uppercase tracking-[0.12em]",
            resolveCategoryBadgeTone(event.category),
          )}
        >
          {categoryLabel}
        </span>

        <h3 className="mt-1.5 font-display text-[1.25rem] font-semibold leading-[1.08] tracking-tight text-ink md:text-[1.4rem]">
          {event.title}
        </h3>

        {event.venue ? (
          <p className="mt-1.5 line-clamp-1 text-sm text-cream-dim">
            {event.venue}
            {event.city ? ` · ${event.city}` : ""}
          </p>
        ) : event.city ? (
          <p className="mt-1.5 line-clamp-1 text-sm text-cream-dim">
            {event.city}
          </p>
        ) : null}

        <p className="mt-1 text-[13px] italic text-sand">{whenLabel}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => onAddToAgenda?.(event.id)}
            className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-mint/70 decoration-2 underline-offset-4 transition-colors hover:decoration-coral"
          >
            Ajouter à mon agenda
          </button>
          <button
            type="button"
            onClick={() => onRemove?.(event.id)}
            className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:text-coral"
          >
            Retirer
          </button>
        </div>
      </div>
    </article>
  );
}
