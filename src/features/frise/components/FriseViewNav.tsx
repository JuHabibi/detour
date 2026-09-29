"use client";

import { cn } from "@/lib/cn";
import type { FriseView } from "@/features/frise/frise-url-state";

const OPTIONS: { id: FriseView; label: string }[] = [
  { id: "all", label: "Découvrir" },
  { id: "favorites", label: "Mes favoris" },
  { id: "notebook", label: "Mes carnets" },
];

type FriseViewNavProps = {
  value: FriseView;
  onChange: (view: FriseView) => void;
};

/**
 * Navigation principale éditoriale — typographie + soulignement actif.
 * Compacte volontairement pour laisser la frise monter.
 */
export function FriseViewNav({ value, onChange }: FriseViewNavProps) {
  return (
    <nav
      aria-label="Mode de mon parcours culturel"
      className="scrollbar-none -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0"
    >
      <ul className="flex w-max items-end gap-x-5 sm:gap-x-7">
        {OPTIONS.map((option) => {
          const active = value === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(option.id)}
                className={cn(
                  "group relative min-h-11 whitespace-nowrap pb-2 pt-2 text-left transition-colors motion-reduce:transition-none",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
                )}
              >
                <span
                  className={cn(
                    "font-display text-[1.2rem] leading-none tracking-tight sm:text-[1.35rem]",
                    active ? "text-ink" : "text-sand hover:text-ink",
                  )}
                >
                  {option.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-[2px] origin-left bg-coral transition-transform duration-300 motion-reduce:transition-none",
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
