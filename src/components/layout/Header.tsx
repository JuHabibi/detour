"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CITY } from "@/config/city";

/** Plus long des deux labels Account — réserve la largeur (anti-CLS). */
const ACCOUNT_LABEL_WIDTH_SAMPLE = "Se connecter";

type HeaderProps = {
  favoriteCount: number;
  /** Lien logo — `#top` sur la home, `/` ailleurs. */
  homeHref?: string;
  /** Entrée Account. */
  accountHref?: string;
  accountLabel?: string;
  /** Affiche « La promenade » dans la nav (compte connecté uniquement). */
  showFriseNav?: boolean;
};

export function Header({
  favoriteCount,
  homeHref = "#top",
  accountHref = "/account",
  accountLabel = "Se connecter",
  showFriseNav = false,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    firstLinkRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  const linkClass =
    "transition-colors hover:text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[var(--detour-shell-max)] items-center justify-between gap-3 px-5 py-2 md:gap-4 md:px-8 md:py-2.5 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <Link
          href={homeHref}
          className="font-display text-[1.55rem] leading-none tracking-tight 2xl:text-[1.7rem]"
        >
          Détour
          <span className="text-coral" aria-hidden="true">
            .
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5 md:gap-6">
          <nav
            aria-label="Sections"
            className="hidden items-center gap-6 text-[12px] font-medium uppercase tracking-[0.14em] text-ink md:flex"
          >
            <Link href="/#detour" className={linkClass}>
              Sur le radar
            </Link>
            <Link href="/#explorer" className={linkClass}>
              Explorer
            </Link>
            {showFriseNav ? (
              <Link href="/frise" className={linkClass}>
                La promenade
              </Link>
            ) : null}
          </nav>

          <p
            className="hidden text-[12px] uppercase tracking-[0.12em] text-sand sm:block"
            aria-label={`Lieu actuel : ${CITY}`}
          >
            {CITY}
          </p>

          <Link
            href={accountHref}
            className="inline-grid text-[12px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
              aria-hidden="true"
            >
              {ACCOUNT_LABEL_WIDTH_SAMPLE}
            </span>
            <span className="col-start-1 row-start-1 whitespace-nowrap text-right">
              {accountLabel}
            </span>
          </Link>

          <Link
            href={accountHref}
            aria-label={`Mes détours, ${favoriteCount} enregistré${favoriteCount > 1 ? "s" : ""}`}
            className="relative flex size-10 items-center justify-center text-ink transition-colors hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <HeartIcon filled={favoriteCount > 0} />
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center bg-coral text-[9px] font-semibold text-ink",
                favoriteCount > 0 ? "opacity-100" : "opacity-0",
              )}
            >
              {favoriteCount > 0 ? favoriteCount : 0}
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="flex size-10 items-center justify-center text-ink transition-colors hover:text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id={menuId}
          aria-label="Sections"
          className="border-t border-line md:hidden"
        >
          <ul className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-1 px-5 py-3 text-[13px] font-medium uppercase tracking-[0.14em] text-ink">
            <li>
              <Link
                ref={firstLinkRef}
                href="/#detour"
                className={cn("block py-2.5", linkClass)}
                onClick={closeMenu}
              >
                Sur le radar
              </Link>
            </li>
            <li>
              <Link
                href="/#explorer"
                className={cn("block py-2.5", linkClass)}
                onClick={closeMenu}
              >
                Explorer
              </Link>
            </li>
            {showFriseNav ? (
              <li>
                <Link
                  href="/frise"
                  className={cn("block py-2.5", linkClass)}
                  onClick={closeMenu}
                >
                  La promenade
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          className="stroke-current"
          strokeWidth="1.7"
          strokeLinecap="square"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          className="stroke-current"
          strokeWidth="1.7"
          strokeLinecap="square"
        />
      )}
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
