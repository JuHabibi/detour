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
    likelyDemand: 0,
    missRisk: 0,
    hasRegistrationUrl: false,
    ...overrides,
  };
}

describe("resolveEditorialBadge", () => {
  it("planningNeed élevé + registrationUrl → À réserver", () => {
    expect(
      resolveEditorialBadge(
        input({ planningNeed: 4, hasRegistrationUrl: true }),
      ),
    ).toBe("À réserver");
  });

  it("localRarity élevé sans priorité supérieure → Passage rare", () => {
    expect(
      resolveEditorialBadge(input({ localRarity: 4, missRisk: 5 })),
    ).toBe("Passage rare");
  });

  it("planningNeed élevé sans registrationUrl → À anticiper", () => {
    expect(
      resolveEditorialBadge(
        input({ planningNeed: 4, hasRegistrationUrl: false }),
      ),
    ).toBe("À anticiper");
  });

  it("likelyDemand élevé → Fort potentiel", () => {
    expect(resolveEditorialBadge(input({ likelyDemand: 3 }))).toBe(
      "Fort potentiel",
    );
  });

  it("missRisk élevé → Pépite locale", () => {
    expect(resolveEditorialBadge(input({ missRisk: 5 }))).toBe("Pépite locale");
  });

  it("aucun signal suffisant → pas de badge", () => {
    expect(resolveEditorialBadge(input({ planningNeed: 2, missRisk: 2 }))).toBe(
      null,
    );
    expect(resolveEditorialBadge(input())).toBe(null);
  });

  it("une seule pastille maximum — priorité respectée", () => {
    expect(
      resolveEditorialBadge(
        input({
          planningNeed: 5,
          localRarity: 5,
          likelyDemand: 5,
          missRisk: 5,
          hasRegistrationUrl: true,
        }),
      ),
    ).toBe("À réserver");

    expect(
      resolveEditorialBadge(
        input({
          planningNeed: 5,
          localRarity: 5,
          likelyDemand: 5,
          missRisk: 5,
          hasRegistrationUrl: false,
        }),
      ),
    ).toBe("Passage rare");

    expect(
      resolveEditorialBadge(
        input({
          planningNeed: 4,
          likelyDemand: 5,
          missRisk: 5,
          hasRegistrationUrl: false,
        }),
      ),
    ).toBe("À anticiper");

    expect(
      resolveEditorialBadge(
        input({
          likelyDemand: 4,
          missRisk: 5,
        }),
      ),
    ).toBe("Fort potentiel");
  });
});
