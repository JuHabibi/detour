import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventItem } from "@/data/types";

vi.mock("next/image", () => ({
  default: function MockImage(props: {
    alt?: string;
    src?: string | { src: string };
  }) {
    const src = typeof props.src === "string" ? props.src : props.src?.src ?? "";
    return createElement("img", { alt: props.alt ?? "", src });
  },
}));

import { ExplorerEventCard } from "@/features/home/components/cards/ExplorerEventCard";

function explorerEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "evt-1",
    title: "Concert OpenAgenda",
    category: "Musique",
    genre: "Concert",
    venue: "Scène nationale",
    city: "Orléans",
    date: "2026-10-12",
    dateLabel: "dim. 12 oct.",
    startAt: "2026-10-12T20:00:00+02:00",
    image: "https://example.com/poster.jpg",
    distanceKm: 3.2,
    ...overrides,
  };
}

describe("ExplorerEventCard avec image", () => {
  it("affiche la ville (et la distance) quand city est défini", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerEventCard, {
        event: explorerEvent(),
      }),
    );

    expect(html).toContain("Orléans");
    expect(html).toContain("3,2");
    expect(html).toContain("lucide-map-pin");
    expect(html).toContain("lucide-calendar-clock");
    expect(html).toContain("gap-1.5");
    expect(html).toContain("gap-x-2.5");
  });

  it("n’invente pas de ville quand city est null", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerEventCard, {
        event: explorerEvent({ city: null, distanceKm: undefined }),
      }),
    );

    expect(html).not.toContain("Orléans");
  });
});
