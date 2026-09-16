"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { EventItem } from "@/data/types";
import { eventCalendarPath } from "@/domain/calendar/build-event-calendar";
import { resolveCategoryBadgeTone } from "@/features/home/category-badge-style";
import { cn } from "@/lib/cn";

type AccountGroupEventCardProps = {
  event: EventItem;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
};

export function AccountGroupEventCard({
  event,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onRemove,
}: AccountGroupEventCardProps) {
  const whenLabel = event.time
    ? `${event.dateLabel} · ${event.time}`
    : event.dateLabel;
  const categoryLabel =
    event.genre?.trim() ||
    (event.category === "tout" ? "Autre" : event.category);
  const place =
    [event.venue?.trim(), event.city?.trim()].filter(Boolean).join(" · ") ||
    null;

  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleCardActivate() {
    if (selectionMode) onToggleSelect?.(event.id);
  }

  return (
    <article
      className={cn(
        "group relative flex w-full max-w-[24rem] flex-col",
        selectionMode && "cursor-pointer",
      )}
      onClick={selectionMode ? handleCardActivate : undefined}
      onKeyDown={
        selectionMode
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardActivate();
              }
            }
          : undefined
      }
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? selected : undefined}
      tabIndex={selectionMode ? 0 : undefined}
    >
      <div
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden bg-ink/5",
          selected && "border border-coral",
        )}
      >
        {event.image ? (
          <Image
            src={event.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 380px"
            className="object-cover object-center"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-mint-soft/70" />
        )}

        {selectionMode ? (
          <div
            className="absolute left-2 top-2 z-[2] bg-foam/85 p-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(event.id)}
              aria-label={`Sélectionner ${event.title}`}
              className="block size-[18px] accent-coral"
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-block max-w-[calc(100%-1.75rem)] truncate px-1.5 py-0.5",
              "text-[10px] font-medium uppercase tracking-[0.12em]",
              resolveCategoryBadgeTone(event.category),
            )}
          >
            {categoryLabel}
          </span>

          {!selectionMode ? (
            <div className="relative -mr-1 shrink-0" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex size-7 items-center justify-center text-sand/80 transition-colors hover:text-ink"
                aria-label="Plus d’actions"
              >
                <span aria-hidden className="text-sm leading-none tracking-widest">
                  ···
                </span>
              </button>
              {menuOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-[12.5rem] border border-line bg-foam py-1 shadow-sm"
                >
                  <a
                    role="menuitem"
                    href={eventCalendarPath(event.id)}
                    className="block w-full px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-paper"
                    onClick={() => setMenuOpen(false)}
                  >
                    Ajouter à mon agenda
                  </a>
                  {onRemove ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:bg-paper hover:text-coral"
                      onClick={() => {
                        setMenuOpen(false);
                        onRemove(event.id);
                      }}
                    >
                      Retirer du groupe
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <h3 className="mt-1.5 line-clamp-2 font-display text-[1.05rem] font-semibold leading-[1.12] tracking-tight text-ink md:text-[1.125rem]">
          {event.title}
        </h3>

        <p className="mt-1 text-[12px] italic text-sand">{whenLabel}</p>

        {place ? (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-cream-dim">
            {place}
          </p>
        ) : null}
      </div>
    </article>
  );
}
