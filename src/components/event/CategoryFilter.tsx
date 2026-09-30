"use client";

import { useEffect, useId, useRef, useState } from "react";
import { categories } from "@/config/event-categories";
import type { CategoryId } from "@/data/types";
import { cn } from "@/lib/cn";

type CategoryFilterProps = {
  category: CategoryId | null;
  onCategoryChange: (value: CategoryId) => void;
  presentation?: "chips" | "menu";
  allLabel?: string;
};

export function CategoryFilter({
  category,
  onCategoryChange,
  presentation = "chips",
  allLabel,
}: CategoryFilterProps) {
  if (presentation === "menu") {
    return (
      <CategoryMenu
        category={category}
        onCategoryChange={onCategoryChange}
        allLabel={allLabel}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label="Filtrer par catégorie"
      className="scrollbar-none -mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {categories.map((item) => {
        const isActive = category === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onCategoryChange(item.id)}
            className={cn(
              "h-9 shrink-0 px-3 text-[13px] transition-colors",
              isActive
                ? "bg-ink text-foam"
                : "bg-foam text-cream-dim hover:bg-mint-soft hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryMenu({
  category,
  onCategoryChange,
  allLabel,
}: Omit<CategoryFilterProps, "presentation">) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    categories.findIndex((item) => item.id === category),
  );
  const activeItem = categories.find((item) => item.id === category);
  const activeLabel =
    activeItem?.id === "tout" && allLabel
      ? allLabel
      : activeItem?.label ?? "Choisir une catégorie";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openMenu() {
    setOpen(true);
    queueMicrotask(() => optionRefs.current[activeIndex]?.focus());
  }

  function selectCategory(value: CategoryId) {
    onCategoryChange(value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      className="relative inline-flex min-w-0 max-w-full items-center gap-2.5"
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
        Catégorie
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          openMenu();
        }}
        className={cn(
          "inline-flex min-h-10 min-w-0 max-w-[18rem] items-center justify-between gap-4 border border-line bg-foam px-3 text-left text-[13px] text-ink",
          "transition-colors hover:border-ink/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
        )}
      >
        <span className="truncate">{activeLabel}</span>
        <span aria-hidden className="shrink-0 text-[11px] text-sand">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Catégorie"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-40 max-h-72 w-[min(18rem,calc(100vw-2.5rem))] overflow-y-auto border border-line bg-paper p-1 shadow-[4px_6px_0_rgb(17_17_17/0.08)]"
        >
          {categories.map((item, index) => {
            const active = item.id === category;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectCategory(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    optionRefs.current[
                      (index + 1) % categories.length
                    ]?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    optionRefs.current[
                      (index - 1 + categories.length) % categories.length
                    ]?.focus();
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    optionRefs.current[0]?.focus();
                  } else if (event.key === "End") {
                    event.preventDefault();
                    optionRefs.current[categories.length - 1]?.focus();
                  }
                }}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink",
                  active
                    ? "bg-ink text-foam"
                    : "text-cream-dim hover:bg-mint-soft hover:text-ink",
                )}
              >
                {item.id === "tout" && allLabel ? allLabel : item.label}
                {active ? <span aria-hidden>·</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
