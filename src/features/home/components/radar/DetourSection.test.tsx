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

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: string | ReturnType<typeof createElement> | null;
    className?: string;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

import { DetourSection } from "@/features/home/components/radar/DetourSection";
import { DETOUR_SECTION_EDITORIAL_LINE } from "@/features/home/editorial-badge-copy";

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

  it("expose la ligne éditoriale sans répéter le hero", () => {
    const html = renderToStaticMarkup(
      createElement(DetourSection, {
        events: [eventAt(0)],
        favorites,
        onToggleFavorite,
      }),
    );
    expect(html).toContain("À repérer maintenant");
    expect(html).toContain(DETOUR_SECTION_EDITORIAL_LINE);
    expect(html).not.toContain(
      "Détour sélectionne ce qui mérite votre attention parmi",
    );
    expect(html).not.toContain("liste exhaustive");
  });

  it("pointe vers /explorer en CTA secondaire après le carrousel", () => {
    const html = renderToStaticMarkup(
      createElement(DetourSection, {
        events: [eventAt(0)],
        favorites,
        onToggleFavorite,
      }),
    );
    expect(html).toContain('href="/explorer"');
    expect(html).toContain("Explorer toutes les sorties");
    expect(html).toContain(
      "Vous n’avez pas trouvé votre bonheur dans notre sélection",
    );
    expect(html).toContain("border-ink/25");
    expect(html).toContain("bg-foam");
    expect(html).not.toContain("Cherchez librement parmi les sorties.");
    expect(html).not.toContain('id="explorer"');
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
