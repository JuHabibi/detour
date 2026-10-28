"use client";

import Link from "next/link";

/** Ancre `#explorer` pour les anciens liens `/#explorer` — CTA vers la page Explorer. */
export function HomeExplorerCta() {
  return (
    <section
      id="explorer"
      className="scroll-mt-20 border-t border-line bg-foam px-5 py-12 md:px-8 md:py-16 lg:px-12 2xl:px-14 min-[1920px]:px-16"
    >
      <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
            Explorer
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-tight text-ink md:text-3xl">
            Trouvez votre prochaine sortie autour d’Orléans.
          </h2>
          <p className="mt-3 text-sm leading-6 text-cream-dim md:text-[0.95rem]">
           Concerts, expos, ateliers… affinez par ville, période ou catégorie selon vos envies.
          </p>
        </div>
        <Link
          href="/explorer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Explorer les sorties
        </Link>
      </div>
    </section>
  );
}
