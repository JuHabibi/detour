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
} from "@/features/home/components/EventDetailModal";
import {
  StandardEventCard,
  resolveRadarCardCtaLabel,
} from "@/features/home/components/EventCard";

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
});

describe("StandardEventCard — CTA Radar (indicateur, pas de bouton)", () => {
  it("affiche « Pourquoi le repérer ? » quand une justification existe", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent(),
        surface: "radar",
        rank: 1,
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="radar-card-cta"');
    expect(html).toContain('data-cta="why-pick"');
    expect(html).toContain("Pourquoi le repérer ?");
    expect(html).toContain("h-7");
    expect(html).toContain("h-[2.75rem]");
    expect(html).toContain("lucide-map-pin");
    expect(html).toContain("lucide-calendar-clock");
    expect(html).toContain("underline");
    expect(html).not.toMatch(
      /data-testid="radar-card-cta"[\s\S]*?lucide-move-up-right/,
    );
    expect(html).not.toMatch(/data-testid="radar-card-cta"[\s\S]*?<button/);
    expect(html).toContain("aspect-[4/5]");
  });

  it("affiche « Découvrir l’événement » sans justification", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent({
          id: "openagenda:77305621",
          radarAiReasons: undefined,
        }),
        surface: "radar",
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain('data-cta="discover"');
    expect(html).toContain("Découvrir l’événement");
    expect(html).toContain("h-7");
  });

  it("n’affiche pas le CTA Radar dans Explorer", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent(),
        surface: "explorer",
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).not.toContain('data-testid="radar-card-cta"');
  });
});

describe("resolveRadarCardCtaLabel", () => {
  it("bascule selon resolveRadarPickReason", () => {
    expect(resolveRadarCardCtaLabel(baseEvent())).toBe("Pourquoi le repérer ?");
    expect(
      resolveRadarCardCtaLabel(
        baseEvent({ id: "openagenda:77305621", radarAiReasons: undefined }),
      ),
    ).toBe("Découvrir l’événement");
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
