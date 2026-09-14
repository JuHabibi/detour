"use client";

import { useEffect, useId, useRef } from "react";
import type { EventItem } from "@/data/types";

type AccountAddToAgendaModalProps = {
  event: EventItem;
  onClose: () => void;
  onConfirm: () => void;
};

function venueLine(event: EventItem): string | null {
  const parts = [event.venue?.trim(), event.city?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function whenLabel(event: EventItem): string {
  return event.time ? `${event.dateLabel} · ${event.time}` : event.dateLabel;
}

export function AccountAddToAgendaModal({
  event,
  onClose,
  onConfirm,
}: AccountAddToAgendaModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const place = venueLine(event);

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
    };
  }, [onClose]);

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
        className="relative z-[1] flex w-full max-w-md flex-col border border-line bg-foam px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6 sm:pt-6"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
            Agenda
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="flex size-9 shrink-0 items-center justify-center text-sand transition-colors hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <h2
          id={titleId}
          className="mt-3 font-display text-[1.55rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[1.7rem]"
        >
          {event.title}
        </h2>

        <p className="mt-3 text-[13px] italic text-sand">{whenLabel(event)}</p>
        {place ? (
          <p className="mt-1.5 text-sm text-cream-dim">{place}</p>
        ) : null}

        <p className="mt-6 text-sm leading-6 text-cream-dim">
          Un fichier <span className="text-ink">.ics</span> sera généré. Vous
          pourrez l’ouvrir dans les principales apps calendrier (Apple Agenda,
          Google Calendar, Outlook…).
        </p>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-8 inline-flex min-h-11 w-full items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam sm:w-auto sm:self-start"
        >
          Ajouter à mon agenda
        </button>

        <p className="mt-3 text-[12px] leading-5 text-sand">
          Maquette — aucun fichier n’est téléchargé pour l’instant.
        </p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
