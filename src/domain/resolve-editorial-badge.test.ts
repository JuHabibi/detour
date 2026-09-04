import { describe, expect, it } from "vitest";
import {
  resolveEditorialBadge,
  type EditorialBadgeInput,
} from "@/domain/resolve-editorial-badge";

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
    // likelyDemand n’est plus un input badge ; un assessment « fort potentiel » seul
    // ne doit rien afficher s’il n’y a que missRisk/planning bas.
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

  it("planningNeed sans réservation → À anticiper", () => {
    expect(
      resolveEditorialBadge(
        input({ planningNeed: 4, hasRegistrationUrl: false }),
      ),
    ).toBe("À anticiper");
  });

  it("missRisk élevé → Pépite locale", () => {
    expect(resolveEditorialBadge(input({ missRisk: 5 }))).toBe("Pépite locale");
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

    expect(
      resolveEditorialBadge(
        input({
          localRarity: 5,
          confidence: 0.5,
          reasons: ["artiste rarement programmé localement"],
          missRisk: 4,
        }),
      ),
    ).toBe("Pépite locale");
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
