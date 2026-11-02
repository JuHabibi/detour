import { describe, expect, it } from "vitest";
import type { PublicEventPageData } from "@/application/events/get-public-event-page";
import type { EventItem } from "@/data/types";
import {
  buildEventPageMetadata,
  buildEventSeoDescription,
  plainEventText,
} from "@/features/event-page/event-page-seo";

function item(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "openagenda:1",
    title: "Nuit des musées",
    category: "Exposition",
    genre: "",
    venue: "Musée",
    city: "Orléans",
    date: "2026-11-15",
    dateLabel: "Samedi 15 novembre",
    description: "Une nuit ouverte",
    image: "https://img.openagenda.com/poster.jpg",
    ...overrides,
  };
}

function data(
  overrides: Partial<PublicEventPageData> = {},
): PublicEventPageData {
  return {
    eventId: "openagenda:1",
    item: item(),
    startAt: "2026-11-15T18:00:00.000Z",
    endAt: "2026-11-15T22:00:00.000Z",
    isEnded: false,
    ...overrides,
  };
}

describe("plainEventText", () => {
  it("retire le HTML non maîtrisé", () => {
    expect(plainEventText("<p>Hello <strong>monde</strong></p>")).toBe(
      "Hello monde",
    );
  });
});

describe("buildEventSeoDescription", () => {
  it("privilégie la description tronquée", () => {
    const long = "a".repeat(200);
    expect(buildEventSeoDescription(data({ item: item({ description: long }) }))).toHaveLength(
      160,
    );
  });

  it("fallback titre — date — ville", () => {
    expect(
      buildEventSeoDescription(
        data({ item: item({ description: undefined }) }),
      ),
    ).toBe("Nuit des musées — Samedi 15 novembre — Orléans");
  });
});

describe("buildEventPageMetadata", () => {
  it("indexe un événement à venir avec canonical et image", () => {
    const meta = buildEventPageMetadata(data());
    expect(meta).toMatchObject({
      title: "Nuit des musées",
      alternates: { canonical: "/evenements/openagenda%3A1" },
      robots: { index: true, follow: true },
      openGraph: {
        siteName: "Détour",
        locale: "fr_FR",
        type: "website",
        url: "/evenements/openagenda%3A1",
      },
      twitter: {
        card: "summary_large_image",
      },
    });
    expect(meta.openGraph?.images).toBeDefined();
  });

  it("noindex un événement terminé", () => {
    expect(buildEventPageMetadata(data({ isEnded: true })).robots).toEqual({
      index: false,
      follow: true,
    });
  });
});
