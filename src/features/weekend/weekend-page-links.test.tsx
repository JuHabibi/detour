import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicWeekendPage } from "@/application/weekend/get-public-weekend-page";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WeekendPage } from "@/features/weekend/components/WeekendPage";
import type { EventItem } from "@/data/types";

vi.mock("next/image", () => ({
  default: (props: { alt?: string; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ""} src={typeof props.src === "string" ? props.src : ""} />
  ),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="header" />,
}));

describe("WeekendPage + SiteFooter HTML", () => {
  it("expose des liens HTML vers fiches, Explorer et navigation publique", () => {
    const page: PublicWeekendPage = {
      saturdayKey: "2026-11-07",
      sundayKey: "2026-11-08",
      weekendLabel: "samedi 7 et dimanche 8 novembre 2026",
      weekendFromIso: "2026-11-06T23:00:00.000Z",
      weekendToIso: "2026-11-08T22:59:59.999Z",
      culturalActiveCount: 3,
      explorerHref: "/explorer",
      events: [
        {
          id: "openagenda:42",
          title: "Concert test",
          category: "Concert",
          genre: "",
          venue: "Scène",
          city: "Orléans",
          date: "2026-11-07",
          dateLabel: "Sam. 7 nov.",
          startAt: "2026-11-07T19:00:00.000Z",
          endAt: "2026-11-07T21:00:00.000Z",
          time: "20:00",
          distanceKm: 0,
        } as unknown as EventItem,
      ],
    };

    const html = renderToStaticMarkup(<WeekendPage page={page} />);
    expect(html).toContain("Que faire à Orléans ce week-end");
    expect(html).toContain(
      "dans l’agenda local, dates et horaires du week-end",
    );
    expect(html).toContain("Sorties de ce week-end");
    expect(html).toContain('href="/evenements/openagenda%3A42"');
    expect(html).toContain('href="/explorer"');
    expect(html).toContain("samedi 7 et dimanche 8 novembre 2026");
    expect(html).toContain("1 proposition");

    const footer = renderToStaticMarkup(<SiteFooter />);
    expect(footer).toContain('href="/"');
    expect(footer).toContain('href="/explorer"');
    expect(footer).toContain('href="/orleans/ce-week-end"');
    expect(footer).toContain('href="/mentions-legales"');
    expect(footer).toContain('href="/confidentialite"');
    expect(footer).not.toContain("mailto:");
  });

  it("état vide honnête sans faux contenu riche", () => {
    const page: PublicWeekendPage = {
      saturdayKey: "2026-11-07",
      sundayKey: "2026-11-08",
      weekendLabel: "samedi 7 et dimanche 8 novembre 2026",
      weekendFromIso: "2026-11-06T23:00:00.000Z",
      weekendToIso: "2026-11-08T22:59:59.999Z",
      culturalActiveCount: 0,
      explorerHref: "/explorer",
      events: [],
    };

    const html = renderToStaticMarkup(<WeekendPage page={page} />);
    expect(html).toContain("Aucune sortie culturelle pertinente");
    expect(html).toContain("Rien à afficher pour l’instant");
    expect(html).not.toContain("Sorties de ce week-end");
  });
});
