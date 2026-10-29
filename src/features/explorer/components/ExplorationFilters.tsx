"use client";

import { V1_COMMUNES, type V1Commune } from "@/domain/geo/v1-communes";

type ExplorationFiltersProps = {
  city: V1Commune | null;
  onCityChange: (value: V1Commune | null) => void;
};

const ALL_CITIES_VALUE = "";

const cityOptions: { id: string; label: string }[] = [
  { id: ALL_CITIES_VALUE, label: "Toutes les villes" },
  ...V1_COMMUNES.map((commune) => ({ id: commune, label: commune })),
];

export function ExplorationFilters({
  city,
  onCityChange,
}: ExplorationFiltersProps) {
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
    <div className="relative inline-flex min-h-11 items-stretch border border-line bg-foam">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
        {accessibleName}
      </span>
      <select
        aria-label={accessibleName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 appearance-none bg-transparent py-2 pl-[4.75rem] pr-9 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-mint"
      >
        {options.map((option) => (
          <option key={option.id || "all"} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sand"
      >
        ▾
      </span>
      <span className="sr-only">{visibleLabel}</span>
    </div>
  );
}
