"use client";

import type { WhenFilter } from "@/domain/time/when-filter";
import { V1_COMMUNES, type V1Commune } from "@/domain/geo/v1-communes";

type ExplorationFiltersProps = {
  when: WhenFilter;
  city: V1Commune | null;
  onWhenChange: (value: WhenFilter) => void;
  onCityChange: (value: V1Commune | null) => void;
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

const ALL_CITIES_VALUE = "";

const cityOptions: { id: string; label: string }[] = [
  { id: ALL_CITIES_VALUE, label: "Toutes les villes" },
  ...V1_COMMUNES.map((commune) => ({ id: commune, label: commune })),
];

export function ExplorationFilters({
  when,
  city,
  onWhenChange,
  onCityChange,
}: ExplorationFiltersProps) {
  const whenLabel =
    whenOptions.find((option) => option.id === when)?.label ?? "Ce week-end";
  const cityLabel =
    cityOptions.find((option) => option.id === (city ?? ALL_CITIES_VALUE))
      ?.label ?? "Toutes les villes";

  return (
    <div
      role="group"
      aria-label="Filtres d’exploration"
      className="flex shrink-0 flex-wrap items-center gap-2"
    >
      <FilterSelect
        accessibleName="Période"
        visibleLabel={whenLabel}
        value={when}
        options={whenOptions}
        onChange={(value) => onWhenChange(value as WhenFilter)}
      />
      <FilterSelect
        accessibleName="Ville"
        visibleLabel={cityLabel}
        value={city ?? ALL_CITIES_VALUE}
        options={cityOptions}
        onChange={(value) =>
          onCityChange(value === ALL_CITIES_VALUE ? null : (value as V1Commune))
        }
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
        className="inline-flex h-11 items-center gap-2 border border-line bg-foam px-4 text-sm text-ink"
      >
        {visibleLabel}
        <Chevron />
      </span>      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={accessibleName}
      >
        {options.map((option) => (
          <option key={option.id || "all"} value={option.id}>
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
