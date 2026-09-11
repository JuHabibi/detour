"use client";

import { categories } from "@/config/event-categories";
import type { CategoryId } from "@/data/types";
import { cn } from "@/lib/cn";

type CategoryFilterProps = {
  category: CategoryId;
  onCategoryChange: (value: CategoryId) => void;
};

export function CategoryFilter({
  category,
  onCategoryChange,
}: CategoryFilterProps) {
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
