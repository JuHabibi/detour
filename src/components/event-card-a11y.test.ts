import { describe, expect, it } from "vitest";
import { resolveEventImageAlt } from "@/components/EventCard";

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
