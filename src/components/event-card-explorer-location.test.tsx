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

import { StandardEventCard } from "@/components/EventCard";

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

describe("StandardEventCard Explorer (avec image)", () => {
  it("affiche la ville (et la distance) quand city est défini", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: explorerEvent(),
        surface: "explorer",
      }),
    );

    expect(html).toContain("Orléans");
    expect(html).toContain("3,2");
  });

  it("n’invente pas de ville quand city est null", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: explorerEvent({ city: null, distanceKm: undefined }),
        surface: "explorer",
      }),
    );

    expect(html).not.toContain("Orléans");
  });
});
