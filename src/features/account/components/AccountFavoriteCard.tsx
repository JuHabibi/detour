"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { EventItem } from "@/data/types";
import { resolveCategoryBadgeTone } from "@/features/home/category-badge-style";
import { cn } from "@/lib/cn";

type AccountFavoriteCardProps = {
  event: EventItem;
  onRemove?: (id: string) => void;
  onAddToAgenda?: (id: string) => void;
  onAddToGroup?: (id: string) => void;
  /** Libellé du bouton retirer — défaut « Retirer ». */
  removeLabel?: string;
  /** Mode bulk : checkbox + pas d’actions secondaires. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /**
   * Compacte « Ajouter à un groupe » + retirer dans un menu `…`.
   * Agenda reste visible. Ignoré en selectionMode / sans onAddToGroup+onRemove.
   */
  secondaryInMenu?: boolean;
};

export function AccountFavoriteCard({
  event,
  onRemove,
  onAddToAgenda,
  onAddToGroup,
  removeLabel = "Retirer",
  selectionMode = false,
  selected = false,
  onToggleSelect,
  secondaryInMenu = false,
}: AccountFavoriteCardProps) {
  const whenLabel = event.time
    ? `${event.dateLabel} · ${event.time}`
    : event.dateLabel;
  const categoryLabel =
    event.genre?.trim() ||
    (event.category === "tout" ? "Autre" : event.category);

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

  const showMenu =
    secondaryInMenu &&
    !selectionMode &&
    Boolean(onAddToGroup || onRemove);

  return (
    <article
      className={cn(
        "group relative flex gap-4 border-b border-line py-5 md:gap-5 md:py-6",
        selectionMode && selected && "bg-mint-soft/40",
      )}
    >
      {selectionMode ? (
        <label className="flex shrink-0 items-start pt-1">
          <span className="sr-only">Sélectionner {event.title}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(event.id)}
            className="size-5 accent-ink"
          />
        </label>
      ) : null}

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

        {!selectionMode ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {onAddToAgenda ? (
              <button
                type="button"
                onClick={() => onAddToAgenda(event.id)}
                className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-mint/70 decoration-2 underline-offset-4 transition-colors hover:decoration-coral"
              >
                Ajouter à mon agenda
              </button>
            ) : null}

            {showMenu ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex size-9 items-center justify-center text-sand transition-colors hover:text-ink"
                  aria-label="Plus d’actions"
                >
                  <span aria-hidden className="text-lg leading-none tracking-widest">
                    ···
                  </span>
                </button>
                {menuOpen ? (
                  <div
                    id={menuId}
                    role="menu"
                    className="absolute right-0 z-20 mt-1 min-w-[12rem] border border-line bg-foam py-1 shadow-sm"
                  >
                    {onAddToGroup ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2.5 text-left text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-paper"
                        onClick={() => {
                          setMenuOpen(false);
                          onAddToGroup(event.id);
                        }}
                      >
                        Ajouter à un groupe
                      </button>
                    ) : null}
                    {onRemove ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2.5 text-left text-[12px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:bg-paper hover:text-coral"
                        onClick={() => {
                          setMenuOpen(false);
                          onRemove(event.id);
                        }}
                      >
                        {removeLabel === "Retirer"
                          ? "Retirer des favoris"
                          : removeLabel}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {onAddToGroup ? (
                  <button
                    type="button"
                    onClick={() => onAddToGroup(event.id)}
                    className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-line underline-offset-4 transition-colors hover:text-coral"
                  >
                    Ajouter à un groupe
                  </button>
                ) : null}
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(event.id)}
                    className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:text-coral"
                  >
                    {removeLabel}
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
