"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GroupSummary } from "@/application/groups";
import {
  carnetCoverRotation,
  carnetCoverTone,
} from "@/features/account/groups/carnet-cover-tone";
import { formatGroupDateRange } from "@/features/account/groups/group-display";
import { cn } from "@/lib/cn";

type AccountCarnetCoverProps = {
  group: GroupSummary;
  /** Index d’affichage — pilote couleur et rotation. */
  toneIndex: number;
  active?: boolean;
  onSelect: (groupId: string) => void;
  onRename: (groupId: string) => void;
  onDelete: (groupId: string) => void;
  onExport: (groupId: string) => void;
};

export function AccountCarnetCover({
  group,
  toneIndex,
  active = false,
  onSelect,
  onRename,
  onDelete,
  onExport,
}: AccountCarnetCoverProps) {
  const tone = carnetCoverTone(toneIndex);
  const rotation = carnetCoverRotation(toneIndex);
  const range = formatGroupDateRange(group);
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

  const countLabel =
    group.eventCount === 0
      ? "Aucun événement"
      : `${group.eventCount} événement${group.eventCount > 1 ? "s" : ""}`;

  return (
    <div
      className={cn(
        "group relative aspect-square w-[11.5rem] shrink-0 snap-start sm:w-auto",
        "origin-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out",
        rotation,
        "motion-safe:hover:z-10 motion-safe:hover:rotate-0 motion-safe:hover:scale-[1.03]",
        active && "z-10 rotate-0",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(group.id)}
        aria-pressed={active}
        className={cn(
          "absolute inset-0 flex flex-col justify-between overflow-hidden p-5 text-left outline-none",
          "shadow-[0_10px_28px_rgb(17_17_17_/_0.12)]",
          "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          active && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
          tone.bg,
          tone.ink,
        )}
      >
        <span className="relative z-[1] text-[10px] font-medium uppercase tracking-[0.18em] opacity-60">
          Carnet
        </span>

        <span className="relative z-[1] min-w-0 flex-1 pt-6">
          <span className="line-clamp-3 font-display text-[1.55rem] font-semibold leading-[1.05] tracking-tight sm:text-[1.7rem]">
            {group.name}
          </span>
          {range ? (
            <span className="mt-2 block line-clamp-2 text-[12px] leading-5 opacity-70">
              {range}
            </span>
          ) : null}
        </span>

        <span className="relative z-[1] mt-4 flex items-center gap-1 text-[12px] font-medium opacity-80">
          <span>{countLabel}</span>
          <span aria-hidden className="text-[13px] leading-none">
            ↗
          </span>
        </span>
      </button>

      <div className="absolute right-2 top-2 z-[2]" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={`Options du carnet ${group.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className={cn(
            "flex size-8 items-center justify-center transition-colors",
            tone.ink,
            "opacity-55 hover:opacity-100 hover:bg-ink/10",
          )}
        >
          <span aria-hidden className="text-base leading-none tracking-widest">
            ···
          </span>
        </button>
        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[11rem] border border-line bg-foam py-1 shadow-sm"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-paper"
              onClick={() => {
                setMenuOpen(false);
                onRename(group.id);
              }}
            >
              Renommer
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-paper"
              onClick={() => {
                setMenuOpen(false);
                onExport(group.id);
              }}
            >
              Exporter (.ics)
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:bg-paper hover:text-coral"
              onClick={() => {
                setMenuOpen(false);
                onDelete(group.id);
              }}
            >
              Supprimer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
