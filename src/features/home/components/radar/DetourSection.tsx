import Link from "next/link";
import { FeaturedEventsCarousel } from "@/features/home/components/radar/FeaturedEventsCarousel";
import { DETOUR_SECTION_EDITORIAL_LINE } from "@/features/home/editorial-badge-copy";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";

type DetourSectionProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  carnetCounts?: Map<string, number>;
  onOrganizeCarnets?: (event: EventItem) => void;
  onOpenDetail?: OpenEventDetailHandler;
};

export function DetourSection({
  events,
  favorites,
  onToggleFavorite,
  carnetCounts,
  onOrganizeCarnets,
  onOpenDetail,
}: DetourSectionProps) {
  if (events.length === 0) return null;

  return (
    <section
      id="detour"
      className="detour-decor detour-decor--radar relative scroll-mt-20 overflow-x-clip bg-mint"
    >
      <link
        rel="preload"
        as="image"
        href="/images/editorial/radar-paper-texture-sauge.webp"
        fetchPriority="high"
      />
      <div className="relative z-[1] mx-auto max-w-[var(--detour-shell-max)] px-5 pb-7 pt-6 md:px-10 md:pb-[5.5rem] md:pt-8 lg:px-16 lg:pt-9 2xl:px-20 2xl:pb-24 2xl:pt-10 min-[1920px]:px-24">
        <div className="mb-11 max-w-[min(100%,36rem)] md:mb-[3.25rem]">
          <h2 className="max-w-[14ch] font-display text-[1.85rem] leading-[1.02] tracking-tight text-ink md:text-[2.75rem] lg:text-[3.125rem] 2xl:text-[3.35rem]">
            À repérer maintenant
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-6 text-ink/70 md:mt-3.5 md:text-[0.95rem]">
            {DETOUR_SECTION_EDITORIAL_LINE}
          </p>
        </div>

        <FeaturedEventsCarousel
          events={events}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          carnetCounts={carnetCounts}
          onOrganizeCarnets={onOrganizeCarnets}
          onOpenDetail={onOpenDetail}
        />

        <p className="mt-6 md:mt-7">
          <Link
            href="/explorer"
            className="text-[12px] font-medium tracking-[0.04em] text-ink/70 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Explorer toutes les sorties
          </Link>
        </p>
      </div>
    </section>
  );
}
