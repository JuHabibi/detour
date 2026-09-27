import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import {
  friseDayMoreLabel,
  sliceFriseDayPreview,
} from "@/features/frise/frise-day-preview";
import { EXPLORER_FRIEZE_DAY_PREVIEW } from "@/features/frise/frise-timeline-model";

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

  it("deux événements : plafond preview, rien de caché", () => {
    const p = sliceFriseDayPreview([ev("a"), ev("b")]);
    expect(EXPLORER_FRIEZE_DAY_PREVIEW).toBe(2);
    expect(p.visible.map((e) => e.id)).toEqual(["a", "b"]);
    expect(p.restCount).toBe(0);
    expect(p.all).toHaveLength(2);
  });

  it("quinze événements : 2 visibles, 13 en reste, données intactes", () => {
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

describe("friseDayMoreLabel", () => {
  it("libellés", () => {
    expect(friseDayMoreLabel(0)).toBe("");
    expect(friseDayMoreLabel(1)).toBe("Voir l’autre événement");
    expect(friseDayMoreLabel(13)).toBe("Voir les 13 autres événements");
  });
});
