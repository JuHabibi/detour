import { describe, expect, it } from "vitest";
import {
  buildFriseHref,
  filterEventsByFriseCategory,
  parseFriseNotebookId,
  parseFriseUrlState,
  parseFriseView,
} from "@/features/frise/frise-url-state";

describe("frise-url-state", () => {
  it("parse view avec défaut all", () => {
    expect(parseFriseView(undefined)).toBe("all");
    expect(parseFriseView("favorites")).toBe("favorites");
    expect(parseFriseView("notebook")).toBe("notebook");
    expect(parseFriseView("evil")).toBe("all");
  });

  it("favorites / notebook → category tout par défaut", () => {
    expect(parseFriseUrlState({ view: "favorites" })).toEqual({
      view: "favorites",
      category: "tout",
      notebookId: null,
      preview: false,
    });
  });

  it("ignore une category historique dans les modes personnels", () => {
    expect(
      parseFriseUrlState({
        view: "favorites",
        category: "Spectacle",
      }).category,
    ).toBe("tout");
    expect(
      parseFriseUrlState({
        view: "notebook",
        category: "Musique",
        notebookId: "11111111-1111-4111-8111-111111111111",
      }).category,
    ).toBe("tout");
  });

  it("conserve category historique", () => {
    expect(parseFriseUrlState({ category: "Musique" })).toMatchObject({
      view: "all",
      category: "Musique",
    });
  });

  it("rejette notebookId invalide / hors mode", () => {
    expect(parseFriseNotebookId("not-uuid")).toBeNull();
    expect(
      parseFriseUrlState({
        view: "all",
        notebookId: "11111111-1111-4111-8111-111111111111",
      }).notebookId,
    ).toBeNull();
    expect(
      parseFriseUrlState({
        view: "notebook",
        notebookId: "11111111-1111-4111-8111-111111111111",
      }).notebookId,
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("buildFriseHref omet les défauts", () => {
    expect(
      buildFriseHref({ view: "all", category: "Musique" }),
    ).toBe("/frise?category=Musique");
    expect(
      buildFriseHref({ view: "favorites", category: "tout" }),
    ).toBe("/frise?view=favorites");
    expect(
      buildFriseHref({
        view: "notebook",
        category: "Spectacle",
        notebookId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(
      "/frise?view=notebook&notebookId=11111111-1111-4111-8111-111111111111",
    );
    expect(
      buildFriseHref({ view: "favorites", category: "Spectacle" }),
    ).toBe("/frise?view=favorites");
  });

  it("filtre catégorie — tout conserve tout", () => {
    const events = [
      { category: "Musique" },
      { category: "Spectacle" },
    ];
    expect(filterEventsByFriseCategory(events, "tout")).toHaveLength(2);
    expect(filterEventsByFriseCategory(events, "Musique")).toEqual([
      { category: "Musique" },
    ]);
  });
});
