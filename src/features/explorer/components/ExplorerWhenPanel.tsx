"use client";

import { useState, type RefObject } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import {
  calendarDayToParisDateKey,
  parisDateKeyToCalendarDay,
} from "@/features/explorer/explorer-calendar-day";
import {
  toParisDateKey,
  type WhenFilter,
} from "@/domain/time/when-filter";
import { cn } from "@/lib/cn";

import "react-day-picker/style.css";

function draftFromProps(
  when: WhenFilter,
  from: string | null,
  to: string | null,
): DateRange | undefined {
  if (when === "range" && from && to) {
    return {
      from: parisDateKeyToCalendarDay(from),
      to: parisDateKeyToCalendarDay(to),
    };
  }
  return undefined;
}

export const EXPLORER_PERIOD_PRESETS: {
  id: Exclude<WhenFilter, "range">;
  label: string;
}[] = [
  { id: "today", label: "Aujourd’hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Ce week-end" },
  { id: "next-week", label: "Semaine prochaine" },
  { id: "this-month", label: "Ce mois-ci" },
  { id: "next-month", label: "Mois prochain" },
  { id: "upcoming", label: "À venir" },
];

type ExplorerWhenPanelProps = {
  when: WhenFilter;
  from: string | null;
  to: string | null;
  onPresetChange: (when: Exclude<WhenFilter, "range">) => void;
  onRangeApply: (from: string, to: string) => void;
  /** Focus initial optionnel (mobile sheet). */
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
};

export function ExplorerWhenPanel({
  when,
  from,
  to,
  onPresetChange,
  onRangeApply,
  initialFocusRef,
}: ExplorerWhenPanelProps) {
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    draftFromProps(when, from, to),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const [syncedRange, setSyncedRange] = useState({ when, from, to });
  // Borne « aujourd’hui » métier = jour civil Europe/Paris.
  const todayKey = toParisDateKey(new Date());
  const todayDate = parisDateKeyToCalendarDay(todayKey);

  // Alignement synchrone des props (évite setState dans un effet).
  if (
    when !== syncedRange.when ||
    from !== syncedRange.from ||
    to !== syncedRange.to
  ) {
    setSyncedRange({ when, from, to });
    setDraft(draftFromProps(when, from, to));
    setDraftError(null);
  }

  function handleApply() {
    if (!draft?.from) {
      setDraftError("Choisissez un jour ou un intervalle.");
      return;
    }
    // Clés = libellés civils des cellules DayPicker (pas toParisDateKey ni ISO).
    const fromKey = calendarDayToParisDateKey(draft.from);
    const toKey = calendarDayToParisDateKey(draft.to ?? draft.from);
    if (fromKey < todayKey) {
      setDraftError("Choisissez une date à venir.");
      return;
    }
    if (fromKey > toKey) {
      setDraftError("La fin doit être après le début.");
      return;
    }
    setDraftError(null);
    onRangeApply(fromKey, toKey);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        role="group"
        aria-label="Raccourcis de période"
        className="grid grid-cols-2 gap-1.5"
      >
        {EXPLORER_PERIOD_PRESETS.map((option, index) => {
          const active = when === option.id;
          return (
            <button
              key={option.id}
              ref={index === 0 ? initialFocusRef : undefined}
              type="button"
              aria-pressed={active}
              onClick={() => onPresetChange(option.id)}
              className={cn(
                "inline-flex min-h-10 items-center justify-center border px-2.5 text-center text-[12px] font-medium tracking-[0.02em] transition-colors",
                active
                  ? "border-ink bg-ink text-foam"
                  : "border-line bg-foam text-ink hover:border-ink/40",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
          Ou choisir des dates
        </p>
        <DayPicker
          mode="range"
          locale={fr}
          weekStartsOn={1}
          selected={draft}
          onSelect={setDraft}
          disabled={{ before: todayDate }}
          defaultMonth={draft?.from ?? todayDate}
          className="rdp-detour rdp-detour--fill"
        />
        {draftError ? (
          <p className="mt-2 text-sm text-coral" role="alert">
            {draftError}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-[12px] font-medium text-sand underline decoration-line underline-offset-4 hover:text-ink"
            onClick={() => {
              setDraft(undefined);
              setDraftError(null);
            }}
          >
            Effacer
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center bg-mint px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
            onClick={handleApply}
          >
            Voir les sorties
          </button>
        </div>
      </div>
    </div>
  );
}
