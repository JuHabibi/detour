"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StandardEventCard } from "@/features/home/components/EventCard";
import type { EventItem } from "@/data/types";
import { cn } from "@/lib/cn";

type FeaturedEventsCarouselProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
};

/** Largeur unique pour toutes les affiches Radar (−~8 % vs 28 % lg précédent). */
const RADAR_POSTER_WIDTH =
  "w-[72%] sm:w-[40%] md:w-[32%] lg:w-[26%] 2xl:w-[24%] min-[1920px]:w-[22%]";

/** Carousel horizontal — sélection Radar (affiches uniformes). */
export function FeaturedEventsCarousel({
  events,
  favorites,
  onToggleFavorite,
}: FeaturedEventsCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollPrev(node.scrollLeft > 4);
    setCanScrollNext(node.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    updateScrollState();
    node.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(node);

    return () => {
      node.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      observer.disconnect();
    };
  }, [events, updateScrollState]);

  function scrollByPage(direction: -1 | 1) {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = Math.max(node.clientWidth * 0.85, 260);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({
      left: direction * amount,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }

  if (events.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={cn(
          "flex items-stretch gap-3 overflow-x-auto md:gap-4",
          "snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        )}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Sur le radar — sélection éditoriale"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollByPage(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollByPage(-1);
          }
        }}
      >
        {events.map((event, index) => (
          <div
            key={event.id}
            className={cn("flex h-full shrink-0 snap-start flex-col", RADAR_POSTER_WIDTH)}
          >
            <StandardEventCard
              event={event}
              priority={index < 2}
              isFavorite={favorites.has(event.id)}
              onToggleFavorite={onToggleFavorite}
              rank={index + 1}
              surface="radar"
            />
          </div>
        ))}
      </div>

      <CarouselArrow
        direction="prev"
        disabled={!canScrollPrev}
        onClick={() => scrollByPage(-1)}
      />
      <CarouselArrow
        direction="next"
        disabled={!canScrollNext}
        onClick={() => scrollByPage(1)}
      />
    </div>
  );
}

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  if (disabled) return null;

  const isPrev = direction === "prev";

  return (
    <button
      type="button"
      aria-label={isPrev ? "Événements précédents" : "Événements suivants"}
      onClick={onClick}
      className={cn(
        "absolute top-[28%] z-10 hidden size-9 -translate-y-1/2 items-center justify-center",
        "bg-ink text-foam transition hover:bg-coral hover:text-ink",
        "md:flex",
        isPrev ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3",
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {isPrev ? "‹" : "›"}
      </span>
    </button>
  );
}
