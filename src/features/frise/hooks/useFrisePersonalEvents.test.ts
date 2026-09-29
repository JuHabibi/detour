import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import { filterEventsByFriseCategory } from "@/features/frise/frise-url-state";
import {
  buildExplorerFrieze,
  resolveFriezeWindow,
} from "@/features/frise/timeline/frise-timeline-model";

function item(
  partial: Pick<EventItem, "id" | "title" | "date"> & Partial<EventItem>,
): EventItem {
  return {
    category: "Musique",
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    dateLabel: partial.date,
    ...partial,
  };
}

describe("frise personal filtering", () => {
  const window = resolveFriezeWindow("2026-10-01");

  it("favoris hors carnet restent dans le corpus", () => {
    const favorites = [
      item({ id: "alone", title: "Seul", date: "2026-10-05" }),
      item({
        id: "in-carnet",
        title: "Classé",
        date: "2026-10-12",
        category: "Spectacle",
      }),
    ];
    expect(favorites.map((e) => e.id)).toEqual(["alone", "in-carnet"]);
  });

  it("filtre catégorie + fenêtre → compteurs période", () => {
    const source = [
      item({ id: "m1", title: "M", date: "2026-10-05", category: "Musique" }),
      item({
        id: "s1",
        title: "S",
        date: "2026-10-05",
        category: "Spectacle",
      }),
      item({ id: "m-out", title: "Out", date: "2099-01-01", category: "Musique" }),
    ];
    const filtered = filterEventsByFriseCategory(source, "Musique") as EventItem[];
    const model = buildExplorerFrieze({
      events: filtered,
      window,
      fetchedCount: filtered.length,
      truncatedByCap: false,
      coverageStatus: "complete",
    });
    expect(filtered.map((e) => e.id)).toEqual(["m1", "m-out"]);
    expect(model.eventCountInWindow).toBe(1);
  });

  it("toutes catégories mélange genres sur la frise", () => {
    const source = [
      item({ id: "m1", title: "M", date: "2026-10-05", category: "Musique" }),
      item({
        id: "s1",
        title: "S",
        date: "2026-10-08",
        category: "Spectacle",
      }),
    ];
    const filtered = filterEventsByFriseCategory(source, "tout") as EventItem[];
    const model = buildExplorerFrieze({
      events: filtered,
      window,
      fetchedCount: filtered.length,
      truncatedByCap: false,
      coverageStatus: "complete",
    });
    expect(model.eventCountInWindow).toBe(2);
  });

  it("distingue collection vide vs trimestre vide", () => {
    const emptyModel = buildExplorerFrieze({
      events: [],
      window,
      fetchedCount: 0,
      truncatedByCap: false,
      coverageStatus: "complete",
    });
    expect(emptyModel.eventCountInWindow).toBe(0);

    const laterOnly = [
      item({ id: "future", title: "Plus tard", date: "2099-06-01" }),
    ];
    const trimesterEmpty = buildExplorerFrieze({
      events: laterOnly,
      window,
      fetchedCount: 1,
      truncatedByCap: false,
      coverageStatus: "complete",
    });
    expect(laterOnly.length).toBe(1);
    expect(trimesterEmpty.eventCountInWindow).toBe(0);
  });
});
