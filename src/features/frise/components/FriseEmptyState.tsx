import Link from "next/link";

type FriseEmptyStateProps = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
  onCtaClick?: () => void;
};

/**
 * État vide contextualisé — hors piste, sans changer automatiquement de trimestre.
 */
export function FriseEmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: FriseEmptyStateProps) {
  const ctaClassName =
    "inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam";

  return (
    <div
      className="border border-line bg-foam px-5 py-6 md:px-6 md:py-7"
      aria-live="polite"
    >
      <h2 className="font-display text-[1.55rem] leading-[1.08] tracking-tight text-ink md:text-[1.75rem]">
        {title}
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-cream-dim">
        {description}
      </p>
      <div className="mt-6">
        {ctaHref ? (
          <Link href={ctaHref} className={ctaClassName}>
            {ctaLabel}
          </Link>
        ) : (
          <button type="button" onClick={onCtaClick} className={ctaClassName}>
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
