import { describe, expect, it } from "vitest";
import {
  EDITORIAL_BADGE_EXPLANATIONS,
  getEditorialBadgeExplanation,
} from "@/components/editorial-badge-copy";
import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";

const BADGES: EditorialBadge[] = [
  "À réserver",
  "À anticiper",
  "Passage rare",
  "Pépite locale",
];

const AI_JARGON =
  /\b(IA|AI|algorithme|algorithmique|recommandé par l['’]IA|scoring|ranking|machine learning|missRisk|localRarity)\b/i;

describe("editorial-badge-copy", () => {
  it("fournit une micro-explication pour chaque badge métier", () => {
    for (const badge of BADGES) {
      const text = getEditorialBadgeExplanation(badge);
      expect(text.length).toBeGreaterThan(20);
      expect(EDITORIAL_BADGE_EXPLANATIONS[badge]).toBe(text);
    }
  });

  it("n’utilise pas de jargon IA / technique", () => {
    for (const badge of BADGES) {
      expect(getEditorialBadgeExplanation(badge)).not.toMatch(AI_JARGON);
    }
  });

  it("évite la fausse urgence", () => {
    const urgency =
      /presque complet|derni[eè]res places|vite|urgence|derni[eè]re chance/i;
    for (const badge of BADGES) {
      expect(getEditorialBadgeExplanation(badge)).not.toMatch(urgency);
    }
  });
});
