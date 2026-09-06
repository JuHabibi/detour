"use client";

import { CITY } from "@/config/city";

export function HeroFilters() {
  return (
    <section className="relative overflow-hidden px-5 pb-5 pt-7 md:px-8 md:pb-6 md:pt-8 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-2 size-[9rem] rounded-full bg-sky/18 md:right-[8%] md:size-[11rem]"
      />

      <div className="relative mx-auto max-w-[1440px]">
        <h1 className="max-w-3xl font-display text-[2rem] leading-[1.05] tracking-tight text-ink sm:text-[2.75rem] lg:text-[3.4rem]">
          Ne passez pas à côté de ce qui se passe près de chez vous.
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-cream-dim md:mt-4 md:text-[0.95rem] md:leading-7">
          Détour, votre radar culturel local pour repérer les événements qui se
          perdent facilement dans les agendas.
        </p>

        <div className="mt-5 md:mt-6">
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-foam px-4 py-2.5 text-sm text-ink"
            aria-label={`Lieu : autour d’${CITY}`}
          >
            Autour d’{CITY}
            <Chevron />
          </button>
        </div>
      </div>
    </section>
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
