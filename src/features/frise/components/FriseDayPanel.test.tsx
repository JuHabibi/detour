import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventItem } from "@/data/types";
import { FriseDayPanel } from "@/features/frise/components/FriseDayPanel";
import type { ExplorerFriezeDayCluster } from "@/features/frise/frise-timeline-model";

function ev(id: string, title: string): EventItem {
  return {
    id,
    title,
    category: "Exposition",
    genre: "",
    venue: "Musée",
    city: "Orléans",
    date: "2026-10-03",
    dateLabel: "Sam. 3 oct.",
    startAt: "2026-10-03T10:00:00+02:00",
    time: "10h00",
  };
}

const day: ExplorerFriezeDayCluster = {
  kind: "day",
  id: "day-2026-10-03",
  dateKey: "2026-10-03",
  weekdayLabel: "Samedi",
  dayNumber: "3",
  monthShort: "oct.",
  events: [
    ev("a", "Premier"),
    ev("b", "Deuxième"),
    ev("c", "Troisième"),
  ],
};

describe("FriseDayPanel", () => {
  it("affiche la date, le total et tous les événements du jour", () => {
    const html = renderToStaticMarkup(
      createElement(FriseDayPanel, {
        day,
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="frise-day-panel"');
    expect(html).toContain("Samedi 3 oct.");
    expect(html).toContain("3 événements");
    expect(html).toContain("Premier");
    expect(html).toContain("Deuxième");
    expect(html).toContain("Troisième");
  });
});
