import { describe, expect, it } from "vitest";
import { resolveEventImageAlt } from "@/features/home/components/EventCard";
import { getEditorialBadgeExplanation } from "@/features/home/editorial-badge-copy";

describe("resolveEventImageAlt", () => {
  it("alt vide si pas d’imageAlt distinct (évite double annonce du titre)", () => {
    expect(
      resolveEventImageAlt({ title: "Concert jazz", imageAlt: undefined }),
    ).toBe("");
    expect(
      resolveEventImageAlt({ title: "Concert jazz", imageAlt: "Concert jazz" }),
    ).toBe("");
  });

  it("conserve un alt informatif distinct du titre", () => {
    expect(
      resolveEventImageAlt({
        title: "Duo Zéphyr",
        imageAlt: "Musiciens de jazz en salle intimiste",
      }),
    ).toBe("Musiciens de jazz en salle intimiste");
  });
});

describe("présentation éditoriale (a11y / wording)", () => {
  it("chaque badge a une explication accessible (texte associé)", () => {
    expect(getEditorialBadgeExplanation("Pépite locale")).toContain(
      "sous le radar",
    );
    expect(getEditorialBadgeExplanation("Passage rare")).toContain(
      "inhabituel",
    );
  });
});
