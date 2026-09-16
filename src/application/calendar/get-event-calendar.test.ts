import { describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/db/event.repository", () => ({
  getEventById: vi.fn(),
}));

import { getEventCalendarForId } from "@/application/calendar/get-event-calendar";
import { getEventById } from "@/infrastructure/db/event.repository";
import type { DetourEvent } from "@/domain/events/event";

describe("getEventCalendarForId", () => {
  it("null si event absent", async () => {
    vi.mocked(getEventById).mockResolvedValue(null);
    await expect(getEventCalendarForId("missing")).resolves.toBeNull();
  });

  it("construit ICS + filename depuis la DB", async () => {
    const event: DetourEvent = {
      id: "openagenda:1",
      title: "Concert jazz",
      description: null,
      imageUrl: null,
      startAt: "2026-10-12T18:00:00.000Z",
      endAt: null,
      venue: null,
      city: null,
      latitude: null,
      longitude: null,
      category: null,
      genre: null,
      conditions: null,
      source: null,
      sourceUrl: null,
      registrationUrl: null,
    };
    vi.mocked(getEventById).mockResolvedValue(event);

    const payload = await getEventCalendarForId("openagenda:1", {
      now: new Date("2026-09-16T12:00:00.000Z"),
    });
    expect(payload?.filename).toBe("detour-concert-jazz.ics");
    expect(payload?.ics).toContain("UID:openagenda:1@detour");
    expect(getEventById).toHaveBeenCalledWith("openagenda:1");
  });
});
