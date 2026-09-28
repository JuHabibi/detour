import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import {
  EXPLORER_FRIEZE_DAY_PREVIEW,
  EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE,
  friseDayMoreLabel,
  friseDayTrackRestCount,
  sliceFriseDayPreview,
} from "@/features/frise/frise-day-preview";

function ev(id: string): EventItem {
  return {
    id,
    title: id,
    category: "Exposition",
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    date: "2026-10-01",
    dateLabel: "1 oct.",
  };
}

describe("sliceFriseDayPreview", () => {
  it("journée vide", () => {
    const p = sliceFriseDayPreview([]);
    expect(p.visible).toEqual([]);
    expect(p.restCount).toBe(0);
    expect(p.total).toBe(0);
  });

  it("un événement : tout visible", () => {
    const p = sliceFriseDayPreview([ev("a")]);
    expect(p.visible.map((e) => e.id)).toEqual(["a"]);
    expect(p.restCount).toBe(0);
  });

  it("deux événements desktop : 2 visibles, rien de caché", () => {
    const p = sliceFriseDayPreview([ev("a"), ev("b")]);
    expect(EXPLORER_FRIEZE_DAY_PREVIEW).toBe(2);
    expect(p.visible.map((e) => e.id)).toEqual(["a", "b"]);
    expect(p.restCount).toBe(0);
    expect(p.all).toHaveLength(2);
  });

  it("deux événements mobile : 1 visible, 1 en reste", () => {
    const p = sliceFriseDayPreview(
      [ev("a"), ev("b")],
      EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE,
    );
    expect(EXPLORER_FRIEZE_DAY_PREVIEW_MOBILE).toBe(1);
    expect(p.visible.map((e) => e.id)).toEqual(["a"]);
    expect(p.restCount).toBe(1);
    expect(friseDayMoreLabel(p.restCount)).toBe("Voir l’autre événement");
  });

  it("quinze événements : 2 visibles desktop, 13 en reste", () => {
    const events = Array.from({ length: 15 }, (_, i) => ev(`e${i}`));
    const p = sliceFriseDayPreview(events);
    expect(p.visible).toHaveLength(2);
    expect(p.restCount).toBe(13);
    expect(p.total).toBe(15);
    expect(p.all).toHaveLength(15);
    expect(p.visible[0]?.id).toBe("e0");
    expect(p.visible[1]?.id).toBe("e1");
  });

  it("ne mute pas le tableau source", () => {
    const events = [ev("a"), ev("b"), ev("c")];
    sliceFriseDayPreview(events);
    expect(events.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
});

describe("friseDayTrackRestCount", () => {
  it("mobile 1 carte : reste dès le 2ᵉ événement", () => {
    expect(friseDayTrackRestCount(1, 1)).toBe(0);
    expect(friseDayTrackRestCount(2, 1)).toBe(1);
    expect(friseDayTrackRestCount(5, 1)).toBe(4);
  });

  it("desktop 2 cartes : reste dès le 3ᵉ", () => {
    expect(friseDayTrackRestCount(2, 2)).toBe(0);
    expect(friseDayTrackRestCount(3, 2)).toBe(1);
  });
});

describe("friseDayMoreLabel", () => {
  it("libellés", () => {
    expect(friseDayMoreLabel(0)).toBe("");
    expect(friseDayMoreLabel(1)).toBe("Voir l’autre événement");
    expect(friseDayMoreLabel(13)).toBe("Voir les 13 autres événements");
  });
});
