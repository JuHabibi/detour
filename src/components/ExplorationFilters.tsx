"use client";

import type { WhenFilter } from "@/domain/time/when-filter";
import type { RadiusFilter } from "@/data/types";

type ExplorationFiltersProps = {
  when: WhenFilter;
  radius: RadiusFilter;
  onWhenChange: (value: WhenFilter) => void;
  onRadiusChange: (value: RadiusFilter) => void;
};

const whenOptions: { id: WhenFilter; label: string }[] = [
  { id: "today", label: "Aujourd’hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Ce week-end" },
  { id: "next-week", label: "Semaine prochaine" },
  { id: "this-month", label: "Ce mois-ci" },
  { id: "next-month", label: "Mois prochain" },
  { id: "upcoming", label: "À venir" },
];

const radiusOptions: { id: RadiusFilter; label: string }[] = [
  { id: 5, label: "5 km" },
  { id: 15, label: "15 km" },
  { id: 30, label: "30 km" },
  { id: 50, label: "50 km" },
];

export function ExplorationFilters({
  when,
  radius,
  onWhenChange,
  onRadiusChange,
}: ExplorationFiltersProps) {
  const whenLabel =
    whenOptions.find((option) => option.id === when)?.label ?? "Ce week-end";
  const radiusLabel =
    radiusOptions.find((option) => option.id === radius)?.label ?? "15 km";

  return (
    <div
      role="group"
      aria-label="Filtres d’exploration"
      className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
    >
      <FilterSelect
        accessibleName="Période"
        visibleLabel={whenLabel}
        value={when}
        options={whenOptions}
        onChange={(value) => onWhenChange(value as WhenFilter)}
      />
      <FilterSelect
        accessibleName="Rayon"
        visibleLabel={radiusLabel}
        value={String(radius)}
        options={radiusOptions.map((option) => ({
          id: String(option.id),
          label: option.label,
        }))}
        onChange={(value) => onRadiusChange(Number(value) as RadiusFilter)}
      />
    </div>
  );
}

function FilterSelect({
  accessibleName,
  visibleLabel,
  value,
  options,
  onChange,
}: {
  accessibleName: string;
  visibleLabel: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{accessibleName}</span>
      <span
        aria-hidden="true"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-foam px-4 py-2.5 text-sm text-ink"
      >
        {visibleLabel}
        <Chevron />
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={accessibleName}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-sand"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
