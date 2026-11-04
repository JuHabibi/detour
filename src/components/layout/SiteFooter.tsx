import Link from "next/link";
import { SITE_NAME } from "@/config/seo";
import { publicWeekendPath } from "@/config/public-weekend-path";

const footerLinkClass =
  "text-sm text-sand transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Footer éditorial des pages publiques.
 * Liens uniquement vers des routes réelles — pas de pages légales / contact inventées.
 */
export function SiteFooter() {
  const weekendHref = publicWeekendPath();

  return (
    <footer className="border-t border-line px-5 py-12 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16">
      <div className="mx-auto grid max-w-[var(--detour-shell-max)] gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-12">
        <div className="max-w-md space-y-3">
          <p className="font-display text-4xl tracking-tight">
            {SITE_NAME}
            <span className="text-coral">.</span>
          </p>
          <p className="text-sm leading-6 text-sand">
            Radar culturel local autour d’Orléans — pour repérer ce qui mérite
            votre attention, pas pour tout lister.
          </p>
        </div>

        <nav aria-label="Pied de page" className="md:justify-self-end">
          <p className="font-editorial text-lg text-ink">Découvrir</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/" className={footerLinkClass}>
                Le Radar
              </Link>
            </li>
            <li>
              <Link href="/explorer" className={footerLinkClass}>
                Explorer les sorties
              </Link>
            </li>
            <li>
              <Link href={weekendHref} className={footerLinkClass}>
                Ce week-end à Orléans
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
