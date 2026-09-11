import { FeaturedEventsCarousel } from "@/features/home/components/FeaturedEventsCarousel";
import type { EventItem } from "@/data/types";

type DetourSectionProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
};

export function DetourSection({
  events,
  favorites,
  onToggleFavorite,
}: DetourSectionProps) {
  const picks = events.slice(0, 6);
  if (picks.length === 0) return null;

  return (
    <section id="detour" className="scroll-mt-20 bg-mint">
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 pb-7 pt-6 md:px-8 md:pb-10 md:pt-8 lg:px-12 lg:pt-9 2xl:px-14 2xl:pb-11 2xl:pt-10 min-[1920px]:px-16">
        <div className="mb-5 md:mb-7">
          <h2 className="max-w-[14ch] font-display text-[1.85rem] leading-[1.02] tracking-tight text-ink md:text-[2.75rem] lg:text-[3.125rem] 2xl:text-[3.35rem]">
            À repérer maintenant
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-6 text-ink/70 md:mt-3.5 md:text-[0.95rem]">
            Sélection Détour — aujourd’hui plutôt que trop tard.
          </p>
        </div>

        <FeaturedEventsCarousel
          events={picks}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    </section>
  );
}
