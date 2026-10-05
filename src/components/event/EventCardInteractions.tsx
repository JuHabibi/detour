"use client";

import { BookmarkCheck } from "lucide-react";
import type {
  EventDetailSurface,
  OpenEventDetailHandler,
} from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { captureProductEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export type HomeEventCardProps = {
  event: EventItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  carnetCount?: number;
  onOrganizeCarnets?: (event: EventItem) => void;
  priority?: boolean;
  onOpenDetail?: OpenEventDetailHandler;
};

export function canOpenEventDetail(
  event: EventItem,
  onOpenDetail: OpenEventDetailHandler | undefined,
): boolean {
  if (onOpenDetail) return true;
  return Boolean(resolveEventAction(event).href);
}

export function EventOpenControl({
  event,
  surface,
  onOpenDetail,
}: {
  event: EventItem;
  surface: EventDetailSurface;
  onOpenDetail?: OpenEventDetailHandler;
}) {
  if (onOpenDetail) {
    return (
      <button
        type="button"
        className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-label={`Voir le détail — « ${event.title} »`}
        onClick={(clickEvent) => {
          onOpenDetail(event, surface, clickEvent.currentTarget);
        }}
      />
    );
  }

  const action = resolveEventAction(event);
  if (!action.href) return null;

  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      aria-label={`${action.label} — « ${event.title} » (nouvel onglet)`}
      onClick={() => {
        const properties = {
          event_id: event.id,
          city: event.city,
          category: event.category,
          source: event.source ?? null,
          section: surface,
        };
        captureProductEvent(
          surface === "radar" ? "radar_event_opened" : "explorer_event_opened",
          properties,
        );
      }}
    />
  );
}

type IsolatedCardActionEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function isolateCardAction(
  event: IsolatedCardActionEvent,
  action: () => void,
) {
  event.preventDefault();
  event.stopPropagation();
  action();
}

function FavoriteButton({
  isFavorite,
  onClick,
  className,
  eventTitle,
  opensOrganize = false,
}: {
  isFavorite: boolean;
  onClick: () => void;
  className?: string;
  eventTitle: string;
  opensOrganize?: boolean;
}) {
  const ariaLabel = !isFavorite
    ? `Ajouter « ${eventTitle} » aux favoris`
    : opensOrganize
      ? `Ranger « ${eventTitle} » dans un carnet`
      : `Retirer « ${eventTitle} » des favoris`;

  return (
    <button
      type="button"
      onClick={(event) => isolateCardAction(event, onClick)}
      aria-pressed={isFavorite}
      aria-label={ariaLabel}
      className={cn(
        "flex size-11 items-center justify-center border border-line bg-paper/95 text-ink transition-colors hover:bg-mint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        className,
      )}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20s-7.2-4.4-9.2-8.6C1.2 8.2 3 5 6.4 5c2 0 3.3 1.1 3.6 1.5C10.3 6.1 11.6 5 13.6 5 17 5 18.8 8.2 17.2 11.4 15.2 15.6 12 20 12 20Z"
          className={cn(
            isFavorite ? "fill-coral stroke-coral" : "stroke-current",
          )}
          strokeWidth="1.6"
        />
      </svg>
    </button>
  );
}

function CarnetStatusBadge({
  count,
  onClick,
  eventTitle,
  className,
}: {
  count: number;
  onClick: () => void;
  eventTitle: string;
  className?: string;
}) {
  if (count <= 0) return null;

  const label = count === 1 ? "Dans un carnet" : `Dans ${count} carnets`;

  return (
    <button
      type="button"
      onClick={(event) => isolateCardAction(event, onClick)}
      aria-label={`${label} — modifier le classement de « ${eventTitle} »`}
      className={cn(
        "inline-flex w-auto max-w-[11rem] shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1.5 text-[10px] font-medium leading-none tracking-[0.04em] text-foam transition-colors",
        "hover:bg-coral hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
        className,
      )}
    >
      <BookmarkCheck
        aria-hidden
        className="size-3 shrink-0"
        strokeWidth={2}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function CardFavoriteActions({
  event,
  isFavorite,
  onToggleFavorite,
  carnetCount = 0,
  onOrganizeCarnets,
  className,
}: {
  event: EventItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  carnetCount?: number;
  onOrganizeCarnets?: (event: EventItem) => void;
  className?: string;
}) {
  const favorited = Boolean(isFavorite);
  const canOrganize = Boolean(onOrganizeCarnets);
  const showHeart = Boolean(onToggleFavorite) || (favorited && canOrganize);
  const showBadge = favorited && carnetCount > 0 && canOrganize;

  if (!showHeart && !showBadge) return null;

  function handleHeartClick() {
    runHomeFavoriteAction({
      event,
      favorited,
      onToggleFavorite,
      onOrganizeCarnets,
    });
  }

  return (
    <div className={cn("z-[2] flex flex-col items-end gap-2", className)}>
      {showHeart ? (
        <FavoriteButton
          isFavorite={favorited}
          onClick={handleHeartClick}
          eventTitle={event.title}
          opensOrganize={favorited && canOrganize}
        />
      ) : null}
      {showBadge ? (
        <CarnetStatusBadge
          count={carnetCount}
          onClick={() => onOrganizeCarnets?.(event)}
          eventTitle={event.title}
        />
      ) : null}
    </div>
  );
}

export function runHomeFavoriteAction({
  event,
  favorited,
  onToggleFavorite,
  onOrganizeCarnets,
}: {
  event: EventItem;
  favorited: boolean;
  onToggleFavorite?: (id: string) => void;
  onOrganizeCarnets?: (event: EventItem) => void;
}) {
  if (!favorited) {
    onToggleFavorite?.(event.id);
    return;
  }
  if (onOrganizeCarnets) {
    onOrganizeCarnets(event);
    return;
  }
  onToggleFavorite?.(event.id);
}

export function resolveEventAction(event: EventItem): {
  href?: string;
  label: string;
} {
  if (
    event.availabilityStatus === "sold_out" ||
    event.availabilityStatus === "sold_out_online"
  ) {
    if (event.sourceUrl) {
      return { href: event.sourceUrl, label: "Voir les infos" };
    }
    return { label: "Voir les infos" };
  }

  if (event.registrationUrl) {
    return { href: event.registrationUrl, label: "Réserver" };
  }
  if (event.sourceUrl) {
    return { href: event.sourceUrl, label: "Voir les infos" };
  }
  return { label: "Voir les infos" };
}
