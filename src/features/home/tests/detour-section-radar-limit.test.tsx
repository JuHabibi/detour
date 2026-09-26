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

import { DetourSection } from "@/features/home/components/DetourSection";

function eventAt(index: number): EventItem {
  const n = index + 1;
  return {
    id: `evt-${n}`,
    title: `Événement ${n}`,
    category: "Musique",
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    date: "2026-10-12",
    dateLabel: "Lundi 12 octobre",
    startAt: "2026-10-12T20:00:00+02:00",
    image: `https://example.com/${n}.jpg`,
  };
}

describe("DetourSection — pas de plafond UI sur la sélection Radar", () => {
  const favorites = new Set<string>();
  const onToggleFavorite = () => undefined;

  it("0 événement → section absente", () => {
    const html = renderToStaticMarkup(
      createElement(DetourSection, {
        events: [],
        favorites,
        onToggleFavorite,
      }),
    );
    expect(html).toBe("");
  });

  it("6 événements → tous rendus, rangs 01…06", () => {
    const events = Array.from({ length: 6 }, (_, i) => eventAt(i));
    const html = renderToStaticMarkup(
      createElement(DetourSection, {
        events,
        favorites,
        onToggleFavorite,
      }),
    );
    for (const event of events) {
      expect(html).toContain(event.title);
    }
    expect(html).toContain(">01<");
    expect(html).toContain(">06<");
    expect(html).not.toContain(">07<");
  });

  it("10 événements → tous accessibles dans l’ordre, rangs 01…10", () => {
    const events = Array.from({ length: 10 }, (_, i) => eventAt(i));
    const html = renderToStaticMarkup(
      createElement(DetourSection, {
        events,
        favorites,
        onToggleFavorite,
      }),
    );
    for (const event of events) {
      expect(html).toContain(event.title);
    }
    // Ordre de sélection préservé dans le DOM
    const positions = events.map((event) => html.indexOf(event.title));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toContain(">01<");
    expect(html).toContain(">10<");
    expect(html).toContain('aria-label="Sur le radar — sélection éditoriale"');
  });
});
