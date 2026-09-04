"use client";

import { categories } from "@/data/events";
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
    <section id="explorer" className="scroll-mt-24 px-5 py-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="scrollbar-none -mx-5 flex gap-1 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
          {categories.map((item) => {
            const isActive = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onCategoryChange(item.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-ink text-paper"
                    : "text-cream-dim hover:text-ink",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
