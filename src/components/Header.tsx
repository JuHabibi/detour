"use client";

import { cn } from "@/lib/cn";

type HeaderProps = {
  favoriteCount: number;
};

export function Header({ favoriteCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-12">
        <a
          href="#top"
          className="font-display text-[1.65rem] leading-none tracking-tight rounded-sm"
        >
          Détour
          <span className="text-coral" aria-hidden="true">
            .
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav
            aria-label="Sections"
            className="hidden items-center gap-6 text-[13px] tracking-[0.12em] text-sand uppercase md:flex"
          >
            <a href="#explorer" className="rounded-sm transition-colors hover:text-ink">
              Explorer
            </a>
            <a href="#a-prevoir" className="rounded-sm transition-colors hover:text-ink">
              À prévoir
            </a>
          </nav>

          <button
            type="button"
            aria-label="Lieu actuel : Orléans"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-foam px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/20"
          >
            <PinIcon />
            <span className="hidden sm:inline" aria-hidden="true">
              Orléans
            </span>
          </button>

          <button
            type="button"
            aria-label={`Mes détours, ${favoriteCount} enregistré${favoriteCount > 1 ? "s" : ""}`}
            className="relative flex size-11 items-center justify-center rounded-full border border-line bg-foam transition-colors hover:border-ink/20"
          >
            <HeartIcon filled={favoriteCount > 0} />
            {favoriteCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-coral text-[10px] font-medium text-ink"
              >
                {favoriteCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="9.8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7.2-4.4-9.2-8.6C1.2 8.2 3 5 6.4 5c2 0 3.3 1.1 3.6 1.5C10.3 6.1 11.6 5 13.6 5 17 5 18.8 8.2 17.2 11.4 15.2 15.6 12 20 12 20Z"
        className={cn(filled ? "fill-coral stroke-coral" : "stroke-current")}
        strokeWidth="1.6"
      />
    </svg>
  );
}
