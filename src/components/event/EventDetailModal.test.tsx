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

import {
  EventDetailModal,
  resolveOfficialSourceLink,
} from "@/components/event/EventDetailModal";

function baseEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "openagenda:36101666",
    title: "Saison culturelle : La Fabrique",
    category: "Spectacle",
    genre: "Théâtre",
    venue: "Théâtre des Longues Allées",
    city: "Saint-Jean-de-Braye",
    date: "2026-10-28",
    dateLabel: "Mercredi 28 octobre",
    startAt: "2026-10-28T15:00:00+02:00",
    time: "15h00",
    image: "https://example.com/poster.jpg",
    description:
      "« La Fabrique », de la compagnie Sans soucis. Ce théâtre de papier et musique est à découvrir.",
    sourceUrl: "https://openagenda.example/fabrique",
    ...overrides,
  };
}

describe("EventDetailModal", () => {
  it("affiche LE REGARD DÉTOUR + À propos depuis le Radar avec override", () => {
    const html = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event: baseEvent(),
        surface: "radar",
        radarPickReason:
          "Un spectacle où le papier prend vie en musique, porté par la compagnie Sans soucis.",
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="detour-regard"');
    expect(html).toContain("Le regard Détour");
    expect(html).toContain(
      "Un spectacle où le papier prend vie en musique, porté par la compagnie Sans soucis.",
    );
    expect(html).toContain('data-testid="event-about"');
    expect(html).toContain("À propos de l’événement");
    expect(html).toContain(
      "« La Fabrique », de la compagnie Sans soucis. Ce théâtre de papier et musique est à découvrir.",
    );
    expect(html).toContain("Voir la fiche officielle");
    expect(html).toContain("lucide-map-pin");
    expect(html).toContain("lucide-calendar-clock");
    expect(html).toContain("lucide-move-up-right");
  });

  it("masque LE REGARD DÉTOUR sans justification, sans espace réservé", () => {
    const html = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event: baseEvent({
          id: "openagenda:77305621",
          title: "Un monde en couleurs",
          description:
            'Exposition en lien avec le spectacle "Le magicien des couleurs"',
          radarAiReasons: undefined,
        }),
        surface: "radar",
        radarPickReason: null,
        onClose: () => undefined,
      }),
    );

    expect(html).not.toContain('data-testid="detour-regard"');
    expect(html).not.toContain("Le regard Détour");
    expect(html).toContain('data-testid="event-about"');
    expect(html).toContain("À propos de l’événement");
  });

  it("n’affiche jamais LE REGARD DÉTOUR depuis Explorer", () => {
    const html = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event: baseEvent({
          registrationUrl: "https://book.example/fabrique",
          availabilityStatus: "available",
        }),
        surface: "explorer",
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('data-surface="explorer"');
    expect(html).not.toContain("Le regard Détour");
    expect(html).toContain("À propos de l’événement");
    expect(html).toContain("Voir les détails et réserver");
  });

  it("hiérarchie lieu / commune séparés", () => {
    const html = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event: baseEvent(),
        surface: "explorer",
        onClose: () => undefined,
      }),
    );

    expect(html).toContain("Théâtre des Longues Allées");
    expect(html).toContain("Saint-Jean-de-Braye");
    expect(html).not.toContain("Théâtre des Longues Allées · Saint-Jean-de-Braye");
  });

  it("affiche prix, disponibilité et conditions seulement s’ils existent", () => {
    const withPractical = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event: baseEvent({
          price: "free",
          availabilityBadge: "Complet",
          conditions: "Sur réservation",
        }),
        surface: "explorer",
        onClose: () => undefined,
      }),
    );
    expect(withPractical).toContain('data-testid="event-practical"');
    expect(withPractical).toContain('data-testid="event-price"');
    expect(withPractical).toContain("Gratuit");
    expect(withPractical).toContain('data-testid="event-availability"');
    expect(withPractical).toContain("Complet");
    expect(withPractical).toContain('data-testid="event-conditions"');
    expect(withPractical).toContain("Sur réservation");

    const withoutPractical = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event: baseEvent({
          price: undefined,
          availabilityBadge: undefined,
          conditions: undefined,
        }),
        surface: "radar",
        radarPickReason: null,
        onClose: () => undefined,
      }),
    );
    expect(withoutPractical).not.toContain('data-testid="event-practical"');
    expect(withoutPractical).not.toContain('data-testid="event-price"');
    expect(withoutPractical).not.toContain("Gratuit");
  });

  it("Radar et Explorer partagent la même hiérarchie pratique", () => {
    const event = baseEvent({
      price: 12,
      conditions: "Tarif réduit -26 ans",
    });
    const radar = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event,
        surface: "radar",
        radarPickReason: "Une proposition rare à anticiper.",
        onClose: () => undefined,
      }),
    );
    const explorer = renderToStaticMarkup(
      createElement(EventDetailModal, {
        event,
        surface: "explorer",
        onClose: () => undefined,
      }),
    );

    for (const html of [radar, explorer]) {
      expect(html).toContain("12 €");
      expect(html).toContain("Tarif réduit -26 ans");
      expect(html).toContain("Théâtre des Longues Allées");
      expect(html).toContain("Saint-Jean-de-Braye");
    }
    expect(radar).toContain("Le regard Détour");
    expect(explorer).not.toContain("Le regard Détour");
  });
});

describe("resolveOfficialSourceLink", () => {
  it("registrationUrl disponible → Voir les détails et réserver", () => {
    expect(
      resolveOfficialSourceLink({
        sourceUrl: "https://source.example",
        registrationUrl: "https://book.example",
        availabilityStatus: "available",
      }),
    ).toEqual({
      href: "https://book.example",
      label: "Voir les détails et réserver",
      kind: "booking",
    });
  });

  it("sourceUrl seul → Voir la fiche officielle (pas de réservation déduite)", () => {
    expect(
      resolveOfficialSourceLink({
        sourceUrl: "https://source.example",
        registrationUrl: undefined,
        availabilityStatus: "unknown",
      }),
    ).toEqual({
      href: "https://source.example",
      label: "Voir la fiche officielle",
      kind: "official",
    });
  });

  it("sold_out + registrationUrl → fiche officielle, pas réserver", () => {
    expect(
      resolveOfficialSourceLink({
        sourceUrl: "https://source.example",
        registrationUrl: "https://book.example",
        availabilityStatus: "sold_out_online",
      }),
    ).toEqual({
      href: "https://source.example",
      label: "Voir la fiche officielle",
      kind: "official",
    });
  });
});
