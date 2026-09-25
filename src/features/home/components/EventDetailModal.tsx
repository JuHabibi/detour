"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { resolveCategoryBadgeTone } from "@/features/home/category-badge-style";
import {
  EventCalendarClockIcon,
  EventMapPinIcon,
  EventMoveUpRightIcon,
} from "@/features/home/components/event-lucide-icons";
import { resolveRadarPickReason } from "@/features/home/resolve-radar-pick-reason";
import type { EventItem } from "@/data/types";
import { captureProductEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export type EventDetailSurface = "radar" | "explorer";

type EventDetailModalProps = {
  event: EventItem;
  surface: EventDetailSurface;
  onClose: () => void;
  /** Élément qui a ouvert la modale — focus restauré à la fermeture. */
  returnFocusTo?: HTMLElement | null;
};

/**
 * Fiche événement Détour — même composant pour Radar et Explorer.
 * Motif dialog aligné sur AccountAddToGroupModal (overlay + Escape + focus).
 */
export function EventDetailModal({
  event,
  surface,
  onClose,
  returnFocusTo,
}: EventDetailModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const pickReason =
    surface === "radar" ? resolveRadarPickReason(event) : null;
  const official = resolveOfficialSourceLink(event);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (
        returnFocusTo &&
        typeof returnFocusTo.focus === "function" &&
        document.contains(returnFocusTo)
      ) {
        returnFocusTo.focus();
      }
    };
  }, [onClose, returnFocusTo]);

  const placeLine = [event.venue?.trim(), event.city?.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="event-detail-modal"
        data-surface={surface}
        className={cn(
          "relative z-[1] flex w-full max-w-lg flex-col",
          "max-h-[min(92vh,40rem)] overflow-hidden",
          "border border-line bg-foam",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
            Fiche Détour
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="flex size-9 shrink-0 items-center justify-center text-sand transition-colors hover:text-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">
          {event.image ? (
            <div className="relative mt-3 aspect-[16/10] overflow-hidden bg-ink/10">
              <Image
                src={event.image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 32rem"
                className="object-cover object-center"
              />
            </div>
          ) : null}

          <div className="mt-4">
            <span
              className={cn(
                "inline-block max-w-full truncate px-2 py-1",
                "text-[11px] font-medium uppercase tracking-[0.1em]",
                resolveCategoryBadgeTone(event.category),
              )}
            >
              {resolveCategoryBadgeLabel(event)}
            </span>
          </div>

          <h2
            id={titleId}
            className="mt-3 font-display text-[1.55rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[1.75rem]"
          >
            {event.title}
          </h2>

          <div className="mt-3 space-y-2.5 text-sm text-cream-dim">
            <p className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2.5 italic text-sand">
              <EventCalendarClockIcon />
              <span className="min-w-0">
                {event.dateLabel}
                {event.time && !event.allDay ? ` · ${event.time}` : ""}
              </span>
            </p>
            {placeLine ? (
              <p className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2.5">
                <EventMapPinIcon />
                <span className="min-w-0">{placeLine}</span>
              </p>
            ) : null}
          </div>

          {pickReason ? (
            <div
              data-testid="detour-regard"
              className="mt-5 border-t border-line pt-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sand">
                Le regard Détour
              </p>
              <p className="mt-2 text-sm leading-6 text-ink">{pickReason}</p>
            </div>
          ) : null}

          {event.description?.trim() ? (
            <div
              data-testid="event-about"
              className={cn(pickReason ? "mt-6 border-t border-line/70 pt-5" : "mt-5")}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
                À propos de l’événement
              </p>
              <p className="mt-2 text-sm leading-6 text-cream-dim">
                {event.description.trim()}
              </p>
            </div>
          ) : null}

          {official ? (
            <a
              href={official.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="event-official-link"
              data-cta={official.kind}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2.5 bg-mint px-4 text-center text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
              onClick={() => {
                captureProductEvent(
                  surface === "radar"
                    ? "radar_event_opened"
                    : "explorer_event_opened",
                  {
                    event_id: event.id,
                    city: event.city,
                    category: event.category,
                    source: event.source ?? null,
                    section: surface,
                  },
                );
              }}
            >
              <span className="min-w-0">{official.label}</span>
              <EventMoveUpRightIcon className="text-current" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type OfficialSourceLink = {
  href: string;
  label: string;
  kind: "booking" | "official";
};

/**
 * CTA organisateur :
 * - « Voir les détails et réserver » uniquement si `registrationUrl` est présent
 *   et que la billetterie n’est pas sold_out* (lien de réservation réel).
 * - sinon « Voir la fiche officielle » via `sourceUrl` (jamais déduit d’un lien quelconque).
 */
export function resolveOfficialSourceLink(
  event: Pick<
    EventItem,
    "sourceUrl" | "registrationUrl" | "availabilityStatus"
  >,
): OfficialSourceLink | null {
  const registrationUrl = event.registrationUrl?.trim() || null;
  const sourceUrl = event.sourceUrl?.trim() || null;
  const soldOut =
    event.availabilityStatus === "sold_out" ||
    event.availabilityStatus === "sold_out_online";

  if (registrationUrl && !soldOut) {
    return {
      href: registrationUrl,
      label: "Voir les détails et réserver",
      kind: "booking",
    };
  }

  if (sourceUrl) {
    return {
      href: sourceUrl,
      label: "Voir la fiche officielle",
      kind: "official",
    };
  }

  if (registrationUrl) {
    return {
      href: registrationUrl,
      label: "Voir la fiche officielle",
      kind: "official",
    };
  }

  return null;
}
