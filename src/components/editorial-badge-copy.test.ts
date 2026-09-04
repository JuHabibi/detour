import { describe, expect, it } from "vitest";
import {
  DETOUR_SECTION_EDITORIAL_LINE,
  DETOUR_SECTION_SUBTITLE,
  EDITORIAL_BADGE_EXPLANATIONS,
  getEditorialBadgeExplanation,
} from "@/components/editorial-badge-copy";
import type { EditorialBadge } from "@/data/types";

const BADGES: EditorialBadge[] = [
  "À réserver",
  "À anticiper",
  "Passage rare",
  "Pépite locale",
];

const AI_JARGON =
  /\b(IA|AI|algorithme|algorithmique|recommandé par l['’]IA|scoring|ranking|machine learning)\b/i;

describe("editorial-badge-copy", () => {
  it("fournit une micro-explication pour chaque badge métier", () => {
    for (const badge of BADGES) {
      const text = getEditorialBadgeExplanation(badge);
      expect(text.length).toBeGreaterThan(20);
      expect(EDITORIAL_BADGE_EXPLANATIONS[badge]).toBe(text);
    }
  });

  it("n’utilise pas de jargon IA / technique", () => {
    expect(DETOUR_SECTION_SUBTITLE).not.toMatch(AI_JARGON);
    expect(DETOUR_SECTION_EDITORIAL_LINE).not.toMatch(AI_JARGON);
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

  it("conserve le sous-titre produit attendu", () => {
    expect(DETOUR_SECTION_SUBTITLE).toBe(
      "Des événements qu’on aurait facilement pu rater.",
    );
  });
});
