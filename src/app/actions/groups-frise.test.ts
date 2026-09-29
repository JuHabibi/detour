import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/application/groups", async () => {
  const actual = await vi.importActual<typeof import("@/application/groups")>(
    "@/application/groups",
  );
  return {
    ...actual,
    getGroupWithEventsForUser: vi.fn(),
    listGroupSummariesForUser: vi.fn(),
    listEventGroupMembershipsForUser: vi.fn(),
  };
});

vi.mock("@/application/map-detour-event-to-ui", () => ({
  mapDetourEventToEventItem: (e: { id: string; title?: string }) => ({
    id: e.id,
    title: e.title ?? e.id,
    category: "Musique",
  }),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import * as groupsApp from "@/application/groups";
import { getMyCarnetEvents } from "@/app/actions/groups";

describe("getMyCarnetEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unauthenticated → pas de repository", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    });
    await expect(getMyCarnetEvents("11111111-1111-4111-8111-111111111111")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(groupsApp.getGroupWithEventsForUser).not.toHaveBeenCalled();
  });

  it("carnet d’un autre user → not_found", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "a@exemple.fr",
        name: "A",
      },
    });
    vi.mocked(groupsApp.getGroupWithEventsForUser).mockResolvedValue(null);

    await expect(
      getMyCarnetEvents("22222222-2222-4222-8222-222222222222"),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
  });

  it("carnet owned → events mappés", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "a@exemple.fr",
        name: "A",
      },
    });
    vi.mocked(groupsApp.getGroupWithEventsForUser).mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      name: "Automne",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [{ id: "e1", title: "Expo" } as never],
    });

    await expect(
      getMyCarnetEvents("22222222-2222-4222-8222-222222222222"),
    ).resolves.toEqual({
      ok: true,
      group: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Automne",
      },
      events: [{ id: "e1", title: "Expo", category: "Musique" }],
    });
  });

  it("groupId invalide → invalid", async () => {
    await expect(getMyCarnetEvents("")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
