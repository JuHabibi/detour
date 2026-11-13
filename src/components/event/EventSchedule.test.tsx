import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventSchedule } from "./EventSchedule";

describe("EventSchedule", () => {
  it("montre séparément les vraies dates et heures Paris, sans les séances passées", () => {
    const html = renderToStaticMarkup(
      createElement(EventSchedule, {
        event: {
          startAt: "2026-11-14T19:00:00Z",
          occurrences: [
            {
              startAt: "2026-10-02T19:00:00Z",
              endAt: "2026-10-02T21:00:00Z",
              allDay: false,
            },
            {
              startAt: "2026-11-14T19:00:00Z",
              endAt: "2026-11-14T21:00:00Z",
              allDay: false,
            },
            {
              startAt: "2026-11-27T19:00:00Z",
              endAt: "2026-11-27T21:00:00Z",
              allDay: false,
            },
          ],
        },
      }),
    );
    expect(html).toContain("Voir les 2 séances");
    expect(html).toContain("20:00");
    expect(html).toContain('dateTime="2026-11-27T19:00:00Z"');
    expect(html).not.toContain("2026-10-02");
    expect(html).not.toContain("Du 14 au 27");
  });

  it("n’invente pas une liste pour un calendrier inconnu ou vide", () => {
    expect(
      renderToStaticMarkup(createElement(EventSchedule, { event: {} })),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        createElement(EventSchedule, { event: { occurrences: [] } }),
      ),
    ).toBe("");
  });
});
