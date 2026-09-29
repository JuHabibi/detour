"use client";

import type { GroupSummary } from "@/application/groups";
import { carnetCoverTone } from "@/features/account/groups/carnet-cover-tone";
import { cn } from "@/lib/cn";

type FriseCarnetThumbsProps = {
  groups: GroupSummary[];
  selectedId: string | null;
  onSelect: (groupId: string) => void;
};

/**
 * Sélecteur compact — pastilles issues de la palette des couvertures /account.
 */
export function FriseCarnetThumbs({
  groups,
  selectedId,
  onSelect,
}: FriseCarnetThumbsProps) {
  return (
    <div
      role="group"
      aria-label="Carnets"
      className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5 md:mx-0 md:flex-wrap md:px-0"
    >
      {groups.map((group, index) => {
        const tone = carnetCoverTone(index);
        const active = selectedId === group.id;
        return (
          <button
            key={group.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(group.id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap border px-3 py-2 text-left text-[13px] outline-none",
              "transition-colors motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
              active
                ? "border-ink bg-foam font-medium text-ink ring-1 ring-ink"
                : "border-line bg-paper/75 text-cream-dim hover:border-ink/40 hover:bg-foam hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 shrink-0 rounded-full border border-ink/15",
                tone.bg,
              )}
            />
            <span>
              {group.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
