"use client";

import Image from "next/image";
import { CITY } from "@/config/city";

/**
 * Hero éditorial — texte gauche, image droite, contenu contenu dans le hero.
 */
export function HeroFilters() {
  return (
    <section className="overflow-hidden bg-paper">
      <div className="grid w-full md:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] md:items-stretch 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,1.08fr)]">
        <div className="flex flex-col justify-center px-5 pt-7 pb-6 md:px-8 md:py-11 lg:py-12 lg:pl-[max(3rem,calc((100vw-var(--detour-shell-max))/2+3rem))] lg:pr-12 2xl:pr-14 2xl:py-14 min-[1920px]:pr-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-sand">
            Radar culturel · {CITY}
          </p>

          <h1 className="mt-4 max-w-[16ch] text-left font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink sm:text-[2.55rem] md:mt-5 md:max-w-[15ch] md:text-[3rem] lg:text-[3.5rem] 2xl:text-[3.75rem] min-[1920px]:text-[4rem]">
            Repérez aujourd’hui ce que vous pourriez regretter de découvrir trop
            tard.
          </h1>

          <p className="mt-5 max-w-md text-[0.95rem] leading-6 text-cream-dim md:mt-6 md:text-[1rem] md:leading-7 2xl:max-w-lg">
            Détour sélectionne ce qui mérite votre attention, pas une liste
            exhaustive de sorties.
          </p>
        </div>

        <div
          aria-hidden
          className="relative hidden min-h-[24.5rem] w-full overflow-hidden md:block lg:min-h-[27rem] 2xl:min-h-[30rem] min-[1920px]:min-h-[33rem]"
        >
          <Image
            src="/new-detour-hero.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-[68%_22%] contrast-[0.96] saturate-[0.92]"
          />
          <div className="absolute inset-0 bg-mint/12 mix-blend-multiply" />
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-paper to-transparent lg:w-24" />
        </div>
      </div>

        <div
          aria-hidden
          className="relative mx-5 mb-6 h-[9rem] overflow-hidden sm:mx-8 sm:h-[10rem] md:hidden"
        >
          <Image
            src="/detour-hero.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-[62%_20%] contrast-[0.96] saturate-[0.92]"
          />
          <div className="absolute inset-0 bg-mint/10 mix-blend-multiply" />
        </div>
    </section>
  );
}
