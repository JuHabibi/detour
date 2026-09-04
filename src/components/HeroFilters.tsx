"use client";

import { CITY } from "@/data/events";
import type { RadiusFilter, WhenFilter } from "@/data/types";

type HeroFiltersProps = {
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
  { id: "pick-date", label: "Choisir une date" },
];

const radiusOptions: { id: RadiusFilter; label: string }[] = [
  { id: 5, label: "5 km" },
  { id: 15, label: "15 km" },
  { id: 30, label: "30 km" },
  { id: 50, label: "50 km" },
];

export function HeroFilters({
  when,
  radius,
  onWhenChange,
  onRadiusChange,
}: HeroFiltersProps) {
  const whenLabel =
    whenOptions.find((option) => option.id === when)?.label ?? "Ce week-end";
  const radiusLabel =
    radiusOptions.find((option) => option.id === radius)?.label ?? "15 km";

  return (
    <section className="relative overflow-hidden px-5 pb-5 pt-7 md:px-8 md:pb-6 md:pt-8 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-2 size-[9rem] rounded-full bg-sky/18 md:right-[8%] md:size-[11rem]"
      />

      <div className="relative mx-auto max-w-[1440px]">
        <h1 className="max-w-3xl font-display text-[2rem] leading-[1.05] tracking-tight text-ink sm:text-[2.75rem] lg:text-[3.4rem]">
          Qu’est-ce qui vaut le{" "}
          <em className="text-coral">détour</em>
          <span className="block">autour de vous&nbsp;?</span>
        </h1>

        <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1 md:mt-6">
          <FilterSelect
            label={whenLabel}
            value={when}
            options={whenOptions}
            onChange={(value) => onWhenChange(value as WhenFilter)}
          />
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-foam px-4 py-2.5 text-sm text-ink"
          >
            Autour d’{CITY}
            <Chevron />
          </button>
          <FilterSelect
            label={radiusLabel}
            value={String(radius)}
            options={radiusOptions.map((option) => ({
              id: String(option.id),
              label: option.label,
            }))}
            onChange={(value) => onRadiusChange(Number(value) as RadiusFilter)}
          />
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-foam px-4 py-2.5 text-sm text-ink">
        {label}
        <Chevron />
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
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
