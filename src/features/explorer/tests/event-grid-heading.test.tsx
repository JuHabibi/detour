import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventGrid } from "@/features/explorer/components/EventGrid";
import {
  explorerPeriodEmptyMessage,
  explorerPeriodResultTitle,
} from "@/features/explorer/explorer-period-copy";

describe("EventGrid — titre page Explorer", () => {
  it("expose un seul h1 « Explorer les sorties »", () => {
    const html = renderToStaticMarkup(
      createElement(EventGrid, {
        title: "Explorer les sorties",
        events: [],
        favorites: new Set<string>(),
        onToggleFavorite: () => {},
      }),
    );

    const h1OpenTags = html.match(/<h1\b/g) ?? [];
    expect(h1OpenTags).toHaveLength(1);
    expect(html).toMatch(/<h1\b[^>]*>Explorer les sorties<\/h1>/);
    expect(html).not.toMatch(/<h2\b[^>]*>Explorer les sorties<\/h2>/);
  });

  it("affiche le sous-titre période et le compteur alignés (week-end)", () => {
    const resultTitle = explorerPeriodResultTitle("weekend");
    const html = renderToStaticMarkup(
      createElement(EventGrid, {
        title: "Explorer les sorties",
        resultTitle,
        emptyMessage: explorerPeriodEmptyMessage("weekend"),
        events: [],
        totalCount: 0,
        favorites: new Set<string>(),
        onToggleFavorite: () => {},
      }),
    );

    expect(html).toContain(resultTitle);
    expect(html).toContain("0 proposition");
    expect(html).toContain(explorerPeriodEmptyMessage("weekend"));
    expect(html).not.toContain("Retrouver tous les événements à venir");
  });

  it("compteur « N sur total » inchangé quand la page est partielle", () => {
    const html = renderToStaticMarkup(
      createElement(EventGrid, {
        title: "Explorer les sorties",
        resultTitle: explorerPeriodResultTitle("weekend"),
        events: [
          {
            id: "e1",
            title: "Concert",
            category: "Musique",
            genre: "",
            venue: null,
            city: "Orléans",
            date: "2026-11-01",
            dateLabel: "Sam. 1 nov.",
          },
        ],
        totalCount: 12,
        favorites: new Set<string>(),
        onToggleFavorite: () => {},
      }),
    );

    expect(html).toContain("1 sur 12");
    expect(html).toContain(explorerPeriodResultTitle("weekend"));
  });
});
