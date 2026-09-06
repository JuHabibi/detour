import { describe, expect, it } from "vitest";
import {
  resolveEditorialBadge,
  type EditorialBadgeInput,
} from "@/domain/editorial/resolve-editorial-badge";

function input(
  overrides: Partial<EditorialBadgeInput> = {},
): EditorialBadgeInput {
  return {
    planningNeed: 0,
    localRarity: 0,
    missRisk: 0,
    confidence: 0,
    reasons: [],
    hasRegistrationUrl: false,
    ...overrides,
  };
}

describe("resolveEditorialBadge", () => {
  it("likelyDemand élevé seul → aucun badge", () => {
    expect(resolveEditorialBadge(input())).toBe(null);
    expect(
      resolveEditorialBadge(
        input({ planningNeed: 0, localRarity: 0, missRisk: 0 }),
      ),
    ).toBe(null);
  });

  it("planningNeed + registrationUrl → À réserver", () => {
    expect(
      resolveEditorialBadge(
        input({ planningNeed: 4, hasRegistrationUrl: true }),
      ),
    ).toBe("À réserver");
  });

  it("rareté justifiée → Passage rare", () => {
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.8,
          reasons: [
            "Passage inhabituel d’un artiste reconnu dans une petite commune",
          ],
        }),
      ),
    ).toBe("Passage rare");
  });

  it("format rare seul → pas Passage rare", () => {
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.75,
          reasons: ["Format rare dans la région"],
        }),
      ),
    ).toBe(null);

    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.8,
          reasons: ["concert dans un format peu courant"],
        }),
      ),
    ).toBe(null);
  });

  it("programmation / passage local → Passage rare", () => {
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.8,
          reasons: ["artiste rarement programmé dans la région"],
        }),
      ),
    ).toBe("Passage rare");

    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.8,
          reasons: ["passage inhabituel dans cette commune"],
        }),
      ),
    ).toBe("Passage rare");
  });

  it("localRarity élevé + rareté dans la commune → Passage rare", () => {
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.8,
          reasons: [
            "Interprétation d’une œuvre connue avec un artiste reconnu",
            "Rareté d’un tel spectacle dans la commune",
          ],
        }),
      ),
    ).toBe("Passage rare");
  });

  it("planningNeed sans réservation → À anticiper", () => {
    expect(
      resolveEditorialBadge(
        input({ planningNeed: 4, hasRegistrationUrl: false }),
      ),
    ).toBe("À anticiper");
  });

  it("missRisk=3 → pas Pépite locale", () => {
    expect(
      resolveEditorialBadge(
        input({
          missRisk: 3,
          confidence: 0.9,
          reasons: ["événement facile à rater", "faible visibilité"],
        }),
      ),
    ).toBe(null);
  });

  it("missRisk=4 + reason cohérente → Pépite locale", () => {
    expect(
      resolveEditorialBadge(
        input({
          missRisk: 4,
          confidence: 0.8,
          reasons: ["faible visibilité", "programmation peu relayée"],
        }),
      ),
    ).toBe("Pépite locale");

    expect(
      resolveEditorialBadge(
        input({
          missRisk: 4,
          confidence: 0.7,
          reasons: ["découverte locale facile à rater"],
        }),
      ),
    ).toBe("Pépite locale");
  });

  it("missRisk élevé sans reason pépite → pas Pépite", () => {
    expect(
      resolveEditorialBadge(
        input({
          missRisk: 5,
          confidence: 0.9,
          reasons: ["concert", "singular"],
        }),
      ),
    ).toBe(null);
  });

  it("aucune condition → aucun badge", () => {
    expect(resolveEditorialBadge(input({ planningNeed: 2, missRisk: 2 }))).toBe(
      null,
    );
    expect(resolveEditorialBadge(input())).toBe(null);
  });

  it("localRarity élevé mais reason générique → pas Passage rare", () => {
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 5,
          confidence: 0.9,
          reasons: ["spectacle intéressant", "local-discovery", "singular"],
          missRisk: 2,
        }),
      ),
    ).toBe(null);

    expect(
      resolveEditorialBadge(
        input({
          localRarity: 4,
          confidence: 0.9,
          reasons: ["petite commune", "booking"],
          missRisk: 2,
        }),
      ),
    ).toBe(null);
  });

  it("fallback si rareté non justifiée", () => {
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 5,
          confidence: 0.9,
          reasons: ["concert local"],
          planningNeed: 4,
          hasRegistrationUrl: false,
        }),
      ),
    ).toBe("À anticiper");

    // Confidence trop basse pour Passage rare ; pas de reason pépite → aucun badge
    expect(
      resolveEditorialBadge(
        input({
          localRarity: 5,
          confidence: 0.5,
          reasons: ["artiste rarement programmé localement"],
          missRisk: 4,
        }),
      ),
    ).toBe(null);
  });

  it("une seule pastille — priorité respectée", () => {
    expect(
      resolveEditorialBadge(
        input({
          planningNeed: 5,
          localRarity: 5,
          missRisk: 5,
          confidence: 0.9,
          reasons: ["passage inhabituel dans cette commune"],
          hasRegistrationUrl: true,
        }),
      ),
    ).toBe("À réserver");

    expect(
      resolveEditorialBadge(
        input({
          planningNeed: 5,
          localRarity: 5,
          missRisk: 5,
          confidence: 0.9,
          reasons: ["présence exceptionnelle dans ce lieu"],
          hasRegistrationUrl: false,
        }),
      ),
    ).toBe("Passage rare");

    expect(
      resolveEditorialBadge(
        input({
          planningNeed: 4,
          missRisk: 5,
          hasRegistrationUrl: false,
        }),
      ),
    ).toBe("À anticiper");
  });
});
