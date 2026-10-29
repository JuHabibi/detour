"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  HeaderAccountMenu,
  type HeaderAccountUser,
} from "@/components/layout/HeaderAccountMenu";
import { cn } from "@/lib/cn";

/**
 * Échap : restore le focus sur le bouton menu puis ferme.
 * Un clic lien ne passe pas par ici — la navigation garde le focus.
 */
export function closeMobileMenuOnEscape(
  e: Pick<KeyboardEvent, "key"> & { preventDefault: () => void },
  restoreFocus: () => void,
  close: () => void,
): boolean {
  if (e.key !== "Escape") return false;
  e.preventDefault();
  restoreFocus();
  close();
  return true;
}

export type { HeaderAccountUser };

type HeaderProps = {
  favoriteCount: number;
  /** Lien logo — `#top` sur la home, `/` ailleurs. */
  homeHref?: string;
  /**
   * Utilisateur connecté — avatar + menu + nav personnelle.
   * Absent / null = visiteur → « Se connecter », sans cœur ni liens compte.
   */
  user?: HeaderAccountUser | null;
  /**
   * @deprecated Les liens personnels suivent `user` (connecté).
   * Conservé pour compatibilité des call sites.
   */
  showFriseNav?: boolean;
};

function favoritesAriaLabel(count: number): string {
  if (count <= 0) return "Voir mes favoris";
  if (count === 1) return "Voir mon 1 favori";
  return `Voir mes ${count} favoris`;
}

const navLinkClass =
  "transition-colors hover:text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Header({
  favoriteCount,
  homeHref = "#top",
  user = null,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const isAuthenticated = Boolean(user);

  // Expose la hauteur réelle du header pour coller les barres sticky (Explorer…).
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    function syncHeight() {
      const height = headerRef.current?.offsetHeight;
      if (height == null) return;
      document.documentElement.style.setProperty(
        "--detour-header-height",
        `${height}px`,
      );
    }

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--detour-header-height");
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    firstLinkRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      closeMobileMenuOnEscape(
        e,
        () => menuButtonRef.current?.focus(),
        () => setMenuOpen(false),
      );
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-[var(--detour-shell-max)] items-center justify-between gap-2 px-4 py-2 sm:gap-5 sm:px-5 md:gap-3 md:px-8 md:py-2.5 lg:gap-4 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <Link
          href={homeHref}
          className="font-display text-[1.7rem] leading-none tracking-tight 2xl:text-[1.85rem]"
        >
          Détour
          <span className="text-coral" aria-hidden="true">
            .
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-3 lg:gap-5">
          {/* Desktop : Radar · Explorer · (+ carnets / parcours si connecté) */}
          <nav
            aria-label="Sections"
            className="hidden items-center gap-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink md:flex lg:gap-5 lg:text-[12px] lg:tracking-[0.14em]"
          >
            <Link href="/" className={navLinkClass}>
              Radar
            </Link>
            <Link href="/explorer" className={navLinkClass}>
              Explorer
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/account" className={navLinkClass}>
                  Mes carnets
                </Link>
                <Link href="/frise" className={navLinkClass}>
                  Mon parcours
                </Link>
              </>
            ) : null}
          </nav>

          {/* Cœur : connecté uniquement — compteur + état filled préservés */}
          {isAuthenticated ? (
            <Link
              href="/account#favoris"
              aria-label={favoritesAriaLabel(favoriteCount)}
              className="relative flex size-9 shrink-0 items-center justify-center text-ink transition-colors hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:size-10"
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
          ) : null}

          {user ? (
            <HeaderAccountMenu user={user} />
          ) : (
            <Link
              href="/account"
              className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:text-[12px]"
            >
              Se connecter
            </Link>
          )}

          <button
            ref={menuButtonRef}
            type="button"
            className="flex size-9 shrink-0 items-center justify-center text-ink transition-colors hover:text-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:size-10 md:hidden"
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
          <ul className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-1 px-4 py-3 text-[13px] font-medium uppercase tracking-[0.14em] text-ink sm:px-5">
            <li>
              <Link
                ref={firstLinkRef}
                href="/"
                className={cn("block py-2.5", navLinkClass)}
                onClick={closeMenu}
              >
                Radar
              </Link>
            </li>
            <li>
              <Link
                href="/explorer"
                className={cn("block py-2.5", navLinkClass)}
                onClick={closeMenu}
              >
                Explorer
              </Link>
            </li>
            {isAuthenticated ? (
              <>
                <li>
                  <Link
                    href="/account"
                    className={cn("block py-2.5", navLinkClass)}
                    onClick={closeMenu}
                  >
                    Mes carnets
                  </Link>
                </li>
                <li>
                  <Link
                    href="/frise"
                    className={cn("block py-2.5", navLinkClass)}
                    onClick={closeMenu}
                  >
                    Mon parcours
                  </Link>
                </li>
              </>
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
