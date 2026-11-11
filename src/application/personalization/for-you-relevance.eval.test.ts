/**
 * Évaluation de pertinence V1 — fixtures représentatives du catalogue Explorer.
 * Objectif : détecter de mauvaises correspondances, pas seulement faire passer le code.
 */
import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import {
  selectForYouEvents,
  type ForYouPreferences,
} from "@/domain/personalization/select-for-you-events";

const NOW = new Date("2026-11-11T12:00:00+01:00");

function item(
  partial: Partial<EventItem> & Pick<EventItem, "id" | "title" | "category">,
): EventItem {
  return {
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    date: "2026-11-14",
    dateLabel: "14 nov.",
    startAt: "2026-11-14T20:00:00+01:00",
    ...partial,
  };
}

/** Corpus synthétique aligné sur les catégories / tarifs / créneaux Explorer. */
const CATALOG: EventItem[] = [
  item({
    id: "mus-we-eve",
    title: "Concert jazz",
    category: "Musique",
    venue: "Astrolabe",
    startAt: "2026-11-14T20:30:00+01:00",
    price: 18,
  }),
  item({
    id: "mus-wd-eve",
    title: "Session folk",
    category: "Musique",
    venue: "Café",
    startAt: "2026-11-12T19:00:00+01:00",
    conditions: "Gratuit",
  }),
  item({
    id: "mus-we-day",
    title: "Masterclass guitare",
    category: "Musique",
    venue: "Conservatoire",
    startAt: "2026-11-15T11:00:00+01:00",
    price: 5,
  }),
  item({
    id: "expo-we-day-free",
    title: "Expo photo",
    category: "Exposition",
    venue: "Musée",
    startAt: "2026-11-15T14:00:00+01:00",
    conditions: "Entrée gratuite",
  }),
  item({
    id: "expo-we-day-paid",
    title: "Expo design",
    category: "Exposition",
    venue: "FRAC",
    startAt: "2026-11-14T15:00:00+01:00",
    conditions: "8 €",
  }),
  item({
    id: "expo-wd-eve",
    title: "Nuit des musées",
    category: "Exposition",
    venue: "Musée",
    startAt: "2026-11-13T19:30:00+01:00",
    conditions: "Gratuit",
  }),
  item({
    id: "cine-flex-1",
    title: "Séance auteur",
    category: "Cinéma",
    venue: "Cinématographe",
    startAt: "2026-11-12T20:00:00+01:00",
    price: 7,
  }),
  item({
    id: "cine-flex-2",
    title: "Docu nature",
    category: "Cinéma",
    venue: "Cinéma Lux",
    startAt: "2026-11-16T16:00:00+01:00",
    conditions: "Plein tarif 9 €",
  }),
  item({
    id: "cine-unknown",
    title: "Cycle patrimoine",
    category: "Cinéma",
    venue: "Archives",
    startAt: "2026-11-18T18:30:00+01:00",
    conditions: "Sur réservation",
  }),
  item({
    id: "spectacle-noise",
    title: "Pièce contemporaine",
    category: "Spectacle",
    venue: "Scène nationale",
    startAt: "2026-11-14T20:00:00+01:00",
    price: 25,
  }),
  item({
    id: "expired-like",
    title: "Concert passé (hors pool actif)",
    category: "Musique",
    venue: "Astrolabe",
    startAt: "2026-10-01T20:00:00+02:00",
    price: 20,
  }),
];

function evaluate(label: string, preferences: ForYouPreferences) {
  const interestSet = new Set<string>(preferences.interests);
  const candidates = CATALOG.filter((event) =>
    interestSet.has(String(event.category)),
  );
  const selected = selectForYouEvents(CATALOG, preferences, 8, NOW);

  return {
    label,
    candidateCount: candidates.length,
    matchCount: candidates.length,
    selected: selected.map((event) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      startAt: event.startAt,
      conditions: event.conditions,
      price: event.price,
    })),
  };
}

describe("évaluation pertinence « Pour vous »", () => {
  it("profil Musique + week-end soirée + tous budgets", () => {
    const report = evaluate("musique-we-eve-any", {
      interests: ["Musique"],
      availabilities: ["weekend-evening"],
      budget: "any",
    });

    expect(report.candidateCount).toBe(4);
    expect(report.selected.every((e) => e.category === "Musique")).toBe(true);
    expect(report.selected[0]?.id).toBe("mus-we-eve");
    // Pas de Spectacle injecté pour remplir.
    expect(report.selected.some((e) => e.id === "spectacle-noise")).toBe(false);
  });

  it("profil Exposition + week-end journée + gratuit privilégié", () => {
    const report = evaluate("expo-we-day-free", {
      interests: ["Exposition"],
      availabilities: ["weekend-day"],
      budget: "free_preferred",
    });

    expect(report.candidateCount).toBe(3);
    expect(report.selected[0]?.id).toBe("expo-we-day-free");
    expect(report.selected.map((e) => e.id)).toContain("expo-we-day-paid");
    expect(report.selected.every((e) => e.category === "Exposition")).toBe(true);
  });

  it("profil Cinéma + flexible + tous budgets", () => {
    const report = evaluate("cine-flex-any", {
      interests: ["Cinéma"],
      availabilities: ["flexible"],
      budget: "any",
    });

    expect(report.candidateCount).toBe(3);
    expect(report.selected).toHaveLength(3);
    expect(report.selected[0]?.id).toBe("cine-flex-1");
    // any : pas de biais gratuit artificiel ; tarif inconnu reste éligible.
    expect(report.selected.map((e) => e.id)).toEqual([
      "cine-flex-1",
      "cine-flex-2",
      "cine-unknown",
    ]);
  });

  it("documente les limites catalogue (pas de price normalisé Explorer)", () => {
    // Limite connue : mapDetourEventToEventItem ne remplit pas `price` —
    // la gratuité repose surtout sur `conditions` texte.
    const withoutConditions = selectForYouEvents(
      [
        item({
          id: "no-signal",
          title: "Sans tarif",
          category: "Exposition",
          startAt: "2026-11-15T14:00:00+01:00",
        }),
        item({
          id: "free-text",
          title: "Libre",
          category: "Exposition",
          startAt: "2026-11-16T14:00:00+01:00",
          conditions: "Gratuit",
        }),
      ],
      {
        interests: ["Exposition"],
        availabilities: ["flexible"],
        budget: "free_preferred",
      },
      8,
      NOW,
    );
    expect(withoutConditions[0]?.id).toBe("free-text");
  });
});
