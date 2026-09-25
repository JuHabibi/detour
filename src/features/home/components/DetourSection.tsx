import { FeaturedEventsCarousel } from "@/features/home/components/FeaturedEventsCarousel";
import type { OpenEventDetailHandler } from "@/features/home/components/EventCard";
import type { EventItem } from "@/data/types";

type DetourSectionProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onOpenDetail?: OpenEventDetailHandler;
};

export function DetourSection({
  events,
  favorites,
  onToggleFavorite,
  onOpenDetail,
}: DetourSectionProps) {
  const picks = events.slice(0, 6);
  if (picks.length === 0) return null;

  return (
    <section
      id="detour"
      className="detour-decor detour-decor--radar relative scroll-mt-20 overflow-x-clip bg-mint"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- décor PNG alpha hors LCP */}
        <img
          src="/images/editorial/radar-collage-overlay.png"
          alt=""
          width={737}
          height={413}
          loading="eager"
          decoding="async"
          fetchPriority="low"
          className="detour-overlay detour-overlay--radar"
        />
      </div>
      <div className="relative z-[1] mx-auto max-w-[var(--detour-shell-max)] px-5 pb-7 pt-6 md:px-10 md:pb-10 md:pt-8 lg:px-16 lg:pt-9 2xl:px-20 2xl:pb-11 2xl:pt-10 min-[1920px]:px-24">
        <div className="mb-11 max-w-[min(100%,36rem)] md:mb-[3.25rem]">
          <h2 className="max-w-[14ch] font-display text-[1.85rem] leading-[1.02] tracking-tight text-ink md:text-[2.75rem] lg:text-[3.125rem] 2xl:text-[3.35rem]">
            À repérer maintenant
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-6 text-ink/70 md:mt-3.5 md:text-[0.95rem]">
            Sélection Détour, aujourd’hui plutôt que trop tard.
          </p>
        </div>

        <FeaturedEventsCarousel
          events={picks}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </section>
  );
}
