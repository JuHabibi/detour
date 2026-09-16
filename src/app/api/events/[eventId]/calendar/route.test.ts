import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/application/calendar/get-event-calendar", () => ({
  getEventCalendarForId: vi.fn(),
}));

import { getEventCalendarForId } from "@/application/calendar/get-event-calendar";
import { GET } from "@/app/api/events/[eventId]/calendar/route";

describe("GET /api/events/[eventId]/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404 si event absent", async () => {
    vi.mocked(getEventCalendarForId).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/events/x/calendar"), {
      params: Promise.resolve({ eventId: "missing" }),
    });
    expect(res.status).toBe(404);
    expect(getEventCalendarForId).toHaveBeenCalledWith("missing");
  });

  it("200 text/calendar + Content-Disposition, pas d’auth", async () => {
    vi.mocked(getEventCalendarForId).mockResolvedValue({
      ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      filename: "detour-concert-jazz.ics",
    });

    const res = await GET(
      new Request("http://localhost/api/events/openagenda%3A1/calendar"),
      { params: Promise.resolve({ eventId: "openagenda%3A1" }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="detour-concert-jazz.ics"',
    );
    expect(await res.text()).toContain("BEGIN:VCALENDAR");
    expect(getEventCalendarForId).toHaveBeenCalledWith("openagenda:1");
  });

  it("eventId vide → 404", async () => {
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ eventId: "   " }),
    });
    expect(res.status).toBe(404);
    expect(getEventCalendarForId).not.toHaveBeenCalled();
  });
});
