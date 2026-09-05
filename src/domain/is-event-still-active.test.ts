import { describe, expect, it } from "vitest";
import {
  filterStillActiveEvents,
  isEventStillActive,
} from "@/domain/is-event-still-active";

const now = new Date("2026-09-05T12:00:00.000Z");

describe("isEventStillActive", () => {
  it("start futur sans endAt → garde", () => {
    expect(
      isEventStillActive(
        { startAt: "2026-09-06T20:00:00.000Z", endAt: null },
        now,
      ),
    ).toBe(true);
  });

  it("start passé sans endAt → exclu", () => {
    expect(
      isEventStillActive(
        { startAt: "2026-09-04T20:00:00.000Z", endAt: null },
        now,
      ),
    ).toBe(false);
  });

  it("start passé + endAt futur → garde (encore en cours)", () => {
    expect(
      isEventStillActive(
        {
          startAt: "2026-09-04T10:00:00.000Z",
          endAt: "2026-09-07T18:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("endAt passé → exclu", () => {
    expect(
      isEventStillActive(
        {
          startAt: "2026-09-01T10:00:00.000Z",
          endAt: "2026-09-05T11:59:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("filterStillActiveEvents retire les terminés", () => {
    const kept = filterStillActiveEvents(
      [
        { id: "future", startAt: "2026-10-01T12:00:00.000Z", endAt: null },
        { id: "past", startAt: "2026-08-01T12:00:00.000Z", endAt: null },
        {
          id: "ongoing",
          startAt: "2026-09-01T12:00:00.000Z",
          endAt: "2026-09-10T12:00:00.000Z",
        },
        {
          id: "ended",
          startAt: "2026-09-01T12:00:00.000Z",
          endAt: "2026-09-05T11:00:00.000Z",
        },
      ],
      now,
    );
    expect(kept.map((item) => item.id)).toEqual(["future", "ongoing"]);
  });
});
