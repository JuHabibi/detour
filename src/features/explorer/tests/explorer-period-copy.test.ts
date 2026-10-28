import { describe, expect, it } from "vitest";
import type { WhenFilter } from "@/domain/time/when-filter";
import {
  EXPLORER_PERIOD_EMPTY_MESSAGES,
  EXPLORER_PERIOD_RESULT_TITLES,
  explorerPeriodEmptyMessage,
  explorerPeriodResultTitle,
} from "@/features/explorer/explorer-period-copy";

const ALL_WHEN: WhenFilter[] = [
  "today",
  "tomorrow",
  "weekend",
  "next-week",
  "this-month",
  "next-month",
  "upcoming",
];

describe("explorer-period-copy", () => {
  it("couvre tous les filtres temporels", () => {
    for (const when of ALL_WHEN) {
      expect(EXPLORER_PERIOD_RESULT_TITLES[when]).toBeTruthy();
      expect(EXPLORER_PERIOD_EMPTY_MESSAGES[when]).toBeTruthy();
      expect(explorerPeriodResultTitle(when)).toBe(
        EXPLORER_PERIOD_RESULT_TITLES[when],
      );
      expect(explorerPeriodEmptyMessage(when)).toBe(
        EXPLORER_PERIOD_EMPTY_MESSAGES[when],
      );
    }
  });

  it("weekend ne se confond plus avec « à venir »", () => {
    const weekend = explorerPeriodResultTitle("weekend");
    expect(weekend.toLowerCase()).toContain("week-end");
    expect(weekend.toLowerCase()).not.toContain("à venir");
    expect(weekend).not.toBe(explorerPeriodResultTitle("upcoming"));
  });

  it("ne recopie pas mot pour mot les libellés du select Période", () => {
    const filterLabels = [
      "Aujourd’hui",
      "Demain",
      "Ce week-end",
      "Semaine prochaine",
      "Ce mois-ci",
      "Mois prochain",
      "À venir",
    ];
    for (const when of ALL_WHEN) {
      expect(filterLabels).not.toContain(explorerPeriodResultTitle(when));
    }
  });

  it("empty weekend oriente vers « À venir »", () => {
    const empty = explorerPeriodEmptyMessage("weekend");
    expect(empty.toLowerCase()).toContain("week-end");
    expect(empty).toContain("À venir");
  });
});
