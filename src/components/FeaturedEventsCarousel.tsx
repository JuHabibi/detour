"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StandardEventCard } from "@/components/EventCard";
import type { EventItem } from "@/data/types";
import { cn } from "@/lib/cn";

type FeaturedEventsCarouselProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
};

/** Carousel horizontal léger — section radar (highlights) uniquement. */
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
    const amount = Math.max(node.clientWidth * 0.85, 240);
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
          "flex gap-4 overflow-x-auto pb-1",
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
            className={cn(
              "shrink-0 snap-start",
              "w-[82%] sm:w-[48%] md:w-[47%] lg:w-[32%] xl:w-[24%]",
            )}
          >
            <StandardEventCard
              event={event}
              priority={index < 2}
              isFavorite={favorites.has(event.id)}
              onToggleFavorite={onToggleFavorite}
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
  // Non rendu = non focusable quand inutilisable.
  if (disabled) return null;

  const isPrev = direction === "prev";

  return (
    <button
      type="button"
      aria-label={isPrev ? "Événements précédents" : "Événements suivants"}
      onClick={onClick}
      className={cn(
        "absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center",
        "rounded-full border border-line bg-paper/95 text-ink shadow-sm",
        "transition hover:bg-foam",
        "md:flex",
        isPrev ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3",
      )}
    >
      <span aria-hidden className="text-lg leading-none">
        {isPrev ? "‹" : "›"}
      </span>
    </button>
  );
}
