import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetourEvent } from "@/domain/events/event";

vi.mock("@/infrastructure/db/group.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/infrastructure/db/group.repository")>();
  return {
    ...actual,
    getGroupWithEventsForUser: vi.fn(),
  };
});

import { exportGroupCalendarForUser } from "@/application/calendar/export-group-calendar";
import { getGroupWithEventsForUser } from "@/infrastructure/db/group.repository";

const USER = "11111111-1111-4111-8111-111111111111";
const GROUP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-09-16T12:00:00.000Z");

function event(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title" | "startAt">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
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
    ...partial,
  };
}

describe("exportGroupCalendarForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("not_found si groupe absent / non owned", async () => {
    vi.mocked(getGroupWithEventsForUser).mockResolvedValue(null);
    await expect(
      exportGroupCalendarForUser({ userId: USER, groupId: GROUP }),
    ).resolves.toEqual({ status: "not_found" });
    expect(getGroupWithEventsForUser).toHaveBeenCalledWith(USER, GROUP);
  });

  it("empty si groupe sans events", async () => {
    vi.mocked(getGroupWithEventsForUser).mockResolvedValue({
      id: GROUP,
      userId: USER,
      name: "Vide",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      events: [],
    });
    await expect(
      exportGroupCalendarForUser({ userId: USER, groupId: GROUP }),
    ).resolves.toEqual({ status: "empty" });
  });

  it("groupe complet → ICS multi + filename groupe", async () => {
    vi.mocked(getGroupWithEventsForUser).mockResolvedValue({
      id: GROUP,
      userId: USER,
      name: "Week-end Loire",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      events: [
        event({
          id: "e1",
          title: "A",
          startAt: "2026-10-12T18:00:00.000Z",
        }),
        event({
          id: "e2",
          title: "B",
          startAt: "2026-10-13T18:00:00.000Z",
        }),
      ],
    });

    const result = await exportGroupCalendarForUser({
      userId: USER,
      groupId: GROUP,
      options: { now: NOW },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.payload.filename).toBe("detour-week-end-loire.ics");
    expect(result.payload.eventCount).toBe(2);
    expect(result.payload.ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
  });

  it("sélection : intersection membership, ignore hors groupe", async () => {
    vi.mocked(getGroupWithEventsForUser).mockResolvedValue({
      id: GROUP,
      userId: USER,
      name: "Week-end",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      events: [
        event({
          id: "e1",
          title: "In",
          startAt: "2026-10-12T18:00:00.000Z",
        }),
        event({
          id: "e2",
          title: "Also",
          startAt: "2026-10-13T18:00:00.000Z",
        }),
      ],
    });

    const result = await exportGroupCalendarForUser({
      userId: USER,
      groupId: GROUP,
      eventIds: ["e1", "foreign", "e1"],
      options: { now: NOW },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.payload.eventCount).toBe(1);
    expect(result.payload.filename).toBe("detour-week-end-selection.ics");
    expect(result.payload.ics).toContain("UID:e1@detour");
    expect(result.payload.ics).not.toContain("UID:e2@detour");
    expect(result.payload.ics).not.toContain("foreign");
  });

  it("sélection sans intersection → empty", async () => {
    vi.mocked(getGroupWithEventsForUser).mockResolvedValue({
      id: GROUP,
      userId: USER,
      name: "W",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      events: [
        event({
          id: "e1",
          title: "A",
          startAt: "2026-10-12T18:00:00.000Z",
        }),
      ],
    });

    await expect(
      exportGroupCalendarForUser({
        userId: USER,
        groupId: GROUP,
        eventIds: ["missing"],
      }),
    ).resolves.toEqual({ status: "empty" });
  });
});
