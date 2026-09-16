import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/application/calendar/export-group-calendar", () => ({
  exportGroupCalendarForUser: vi.fn(),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { exportGroupCalendarForUser } from "@/application/calendar/export-group-calendar";
import { GET } from "@/app/api/account/groups/[groupId]/calendar/route";

const USER = "11111111-1111-4111-8111-111111111111";
const GROUP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("GET /api/account/groups/[groupId]/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 si non authentifié", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    });
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ groupId: GROUP }),
    });
    expect(res.status).toBe(401);
    expect(exportGroupCalendarForUser).not.toHaveBeenCalled();
  });

  it("404 not_found / empty", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER, email: "a@ex.fr", name: "A" },
    });
    vi.mocked(exportGroupCalendarForUser).mockResolvedValue({
      status: "not_found",
    });
    await expect(
      GET(new Request("http://localhost/x"), {
        params: Promise.resolve({ groupId: GROUP }),
      }),
    ).resolves.toMatchObject({ status: 404 });

    vi.mocked(exportGroupCalendarForUser).mockResolvedValue({
      status: "empty",
    });
    await expect(
      GET(new Request("http://localhost/x"), {
        params: Promise.resolve({ groupId: GROUP }),
      }),
    ).resolves.toMatchObject({ status: 404 });
  });

  it("200 ICS + ownership session + eventIds query", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER, email: "a@ex.fr", name: "A" },
    });
    vi.mocked(exportGroupCalendarForUser).mockResolvedValue({
      status: "ok",
      payload: {
        ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        filename: "detour-week-end-selection.ics",
        eventCount: 2,
      },
    });

    const res = await GET(
      new Request(
        `http://localhost/api/account/groups/${GROUP}/calendar?eventId=e1&eventId=e2`,
      ),
      { params: Promise.resolve({ groupId: GROUP }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(res.headers.get("Content-Disposition")).toContain(
      "detour-week-end-selection.ics",
    );
    expect(exportGroupCalendarForUser).toHaveBeenCalledWith({
      userId: USER,
      groupId: GROUP,
      eventIds: ["e1", "e2"],
    });
  });
});
