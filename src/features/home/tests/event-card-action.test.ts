import { describe, expect, it } from "vitest";
import { resolveEventAction } from "@/features/home/components/EventCard";
import type { EventItem } from "@/data/types";

function item(partial: Partial<EventItem> & Pick<EventItem, "id" | "title">): EventItem {
  return {
    category: "Spectacle",
    genre: "Théâtre",
    venue: "Espace George Sand",
    city: "Chécy",
    date: "2027-01-20",
    dateLabel: "mer. 20 janv.",
    ...partial,
  };
}

describe("resolveEventAction (disponibilité)", () => {
  it("available + registrationUrl → Réserver", () => {
    expect(
      resolveEventAction(
        item({
          id: "1",
          title: "Spectacle",
          availabilityStatus: "available",
          registrationUrl: "https://billetterie.example/event/1",
          sourceUrl: "https://openagenda.example/e/1",
        }),
      ),
    ).toEqual({
      href: "https://billetterie.example/event/1",
      label: "Réserver",
    });
  });

  it("unknown + registrationUrl → Réserver", () => {
    expect(
      resolveEventAction(
        item({
          id: "2",
          title: "Spectacle",
          availabilityStatus: "unknown",
          registrationUrl: "https://billetterie.example/event/2",
        }),
      ),
    ).toEqual({
      href: "https://billetterie.example/event/2",
      label: "Réserver",
    });
  });

  it("sold_out_online + registrationUrl + sourceUrl → Voir les infos", () => {
    expect(
      resolveEventAction(
        item({
          id: "3",
          title: "Bourgeois",
          availabilityStatus: "sold_out_online",
          registrationUrl: "https://billetterie-checy.mapado.com/event/778760",
          sourceUrl: "https://openagenda.example/e/bourgeois",
          availabilityBadge: "Complet en ligne",
        }),
      ),
    ).toEqual({
      href: "https://openagenda.example/e/bourgeois",
      label: "Voir les infos",
    });
  });

  it("sold_out + registrationUrl + sourceUrl → Voir les infos", () => {
    expect(
      resolveEventAction(
        item({
          id: "4",
          title: "Spectacle",
          availabilityStatus: "sold_out",
          registrationUrl: "https://billetterie.example/event/4",
          sourceUrl: "https://openagenda.example/e/4",
          availabilityBadge: "Complet",
        }),
      ),
    ).toEqual({
      href: "https://openagenda.example/e/4",
      label: "Voir les infos",
    });
  });

  it("sold_out* sans sourceUrl → aucune action", () => {
    expect(
      resolveEventAction(
        item({
          id: "5",
          title: "Spectacle",
          availabilityStatus: "sold_out_online",
          registrationUrl: "https://billetterie.example/event/5",
          availabilityBadge: "Complet en ligne",
        }),
      ).href,
    ).toBeUndefined();

    expect(
      resolveEventAction(
        item({
          id: "6",
          title: "Spectacle",
          availabilityStatus: "sold_out",
          registrationUrl: "https://billetterie.example/event/6",
          availabilityBadge: "Complet",
        }),
      ).href,
    ).toBeUndefined();
  });

  it("badge disponibilité conservé sur l’EventItem sold_out*", () => {
    const online = item({
      id: "7",
      title: "Bourgeois",
      availabilityStatus: "sold_out_online",
      availabilityBadge: "Complet en ligne",
      registrationUrl: "https://billetterie.example/x",
      sourceUrl: "https://openagenda.example/x",
    });
    expect(online.availabilityBadge).toBe("Complet en ligne");
    expect(resolveEventAction(online).label).toBe("Voir les infos");

    const full = item({
      id: "8",
      title: "Autre",
      availabilityStatus: "sold_out",
      availabilityBadge: "Complet",
      registrationUrl: "https://billetterie.example/y",
      sourceUrl: "https://openagenda.example/y",
    });
    expect(full.availabilityBadge).toBe("Complet");
    expect(resolveEventAction(full).label).toBe("Voir les infos");
  });
});
