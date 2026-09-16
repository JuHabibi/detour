import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/application/groups", () => ({
  createGroupForUser: vi.fn(),
  createGroupWithEventsForUser: vi.fn(),
  renameGroupForUser: vi.fn(),
  deleteGroupForUser: vi.fn(),
  addEventToGroupForUser: vi.fn(),
  addEventsToGroupForUser: vi.fn(),
  removeEventFromGroupForUser: vi.fn(),
  normalizeEventIds: (ids: unknown) => {
    if (!Array.isArray(ids)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of ids) {
      if (typeof raw !== "string") continue;
      const t = raw.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  },
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import * as groupsApp from "@/application/groups";
import {
  addFavoriteToGroup,
  addFavoritesToGroup,
  createGroup,
  createGroupWithFavorites,
  deleteGroup,
  removeEventFromGroup,
  renameGroup,
} from "@/app/actions/groups";

const USER_A = "11111111-1111-4111-8111-111111111111";
const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("groups actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unauthenticated → aucun appel repository", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    });

    await expect(createGroup("Week-end")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(groupsApp.createGroupForUser).not.toHaveBeenCalled();
  });

  it("createGroup utilise userId session, pas un userId client", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.createGroupForUser).mockResolvedValue({
      id: GROUP_A,
      userId: USER_A,
      name: "Week-end",
      createdAt: "2026-09-16T10:00:00.000Z",
      updatedAt: "2026-09-16T10:00:00.000Z",
    });

    await expect(createGroup("Week-end")).resolves.toMatchObject({
      ok: true,
      group: { id: GROUP_A, name: "Week-end" },
    });
    expect(groupsApp.createGroupForUser).toHaveBeenCalledWith(
      USER_A,
      "Week-end",
    );
    expect(createGroup.length).toBe(1);
  });

  it("rename/delete/add/remove : ownership via session + groupId", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.renameGroupForUser).mockResolvedValue(null);
    vi.mocked(groupsApp.deleteGroupForUser).mockResolvedValue(false);
    vi.mocked(groupsApp.addEventToGroupForUser).mockResolvedValue({
      status: "not_found",
    });
    vi.mocked(groupsApp.removeEventFromGroupForUser).mockResolvedValue(false);

    await expect(renameGroup(GROUP_A, "X")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(deleteGroup(GROUP_A)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(addFavoriteToGroup(GROUP_A, "e1")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(removeEventFromGroup(GROUP_A, "e1")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });

    expect(groupsApp.renameGroupForUser).toHaveBeenCalledWith(
      USER_A,
      GROUP_A,
      "X",
    );
    expect(groupsApp.deleteGroupForUser).toHaveBeenCalledWith(USER_A, GROUP_A);
    expect(groupsApp.addEventToGroupForUser).toHaveBeenCalledWith(
      USER_A,
      GROUP_A,
      "e1",
    );
    expect(groupsApp.removeEventFromGroupForUser).toHaveBeenCalledWith(
      USER_A,
      GROUP_A,
      "e1",
    );
  });

  it("already_member → raison soft, pas error", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.addEventToGroupForUser).mockResolvedValue({
      status: "already_member",
    });

    await expect(addFavoriteToGroup(GROUP_A, "e1")).resolves.toEqual({
      ok: false,
      reason: "already_member",
    });
  });

  it("createGroup nom trop long → invalid", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.createGroupForUser).mockResolvedValue(null);

    await expect(createGroup("x".repeat(81))).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("addFavoriteToGroup succès → ok", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.addEventToGroupForUser).mockResolvedValue({
      status: "added",
    });

    await expect(addFavoriteToGroup(GROUP_A, "e1")).resolves.toEqual({
      ok: true,
    });
  });

  it("FK event manquant → event_not_found", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.addEventToGroupForUser).mockRejectedValue({
      code: "23503",
    });

    await expect(addFavoriteToGroup(GROUP_A, "missing")).resolves.toEqual({
      ok: false,
      reason: "event_not_found",
    });
  });

  it("addFavoritesToGroup bulk : session + une seule opération", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.addEventsToGroupForUser).mockResolvedValue({
      status: "ok",
      addedCount: 2,
      alreadyMemberCount: 1,
      missingCount: 0,
    });

    await expect(
      addFavoritesToGroup(GROUP_A, ["e1", "e2", "e1"]),
    ).resolves.toEqual({
      ok: true,
      addedCount: 2,
      alreadyMemberCount: 1,
      missingCount: 0,
    });

    expect(groupsApp.addEventsToGroupForUser).toHaveBeenCalledWith(
      USER_A,
      GROUP_A,
      ["e1", "e2"],
    );
    expect(groupsApp.addEventsToGroupForUser).toHaveBeenCalledTimes(1);
    expect(addFavoritesToGroup.length).toBe(2);
  });

  it("addFavoritesToGroup IDOR → not_found", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.addEventsToGroupForUser).mockResolvedValue({
      status: "not_found",
    });

    await expect(addFavoritesToGroup(GROUP_A, ["e1"])).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("createGroupWithFavorites transactionnel via use case", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.createGroupWithEventsForUser).mockResolvedValue({
      status: "ok",
      group: {
        id: GROUP_A,
        userId: USER_A,
        name: "Week-end",
        createdAt: "2026-09-16T10:00:00.000Z",
        updatedAt: "2026-09-16T10:00:00.000Z",
      },
      addedCount: 2,
      alreadyMemberCount: 0,
      missingCount: 0,
    });

    await expect(
      createGroupWithFavorites("Week-end", ["e1", "e2"]),
    ).resolves.toMatchObject({
      ok: true,
      addedCount: 2,
      group: { id: GROUP_A },
    });

    expect(groupsApp.createGroupWithEventsForUser).toHaveBeenCalledWith({
      userId: USER_A,
      name: "Week-end",
      eventIds: ["e1", "e2"],
    });
    expect(groupsApp.createGroupForUser).not.toHaveBeenCalled();
  });

  it("createGroupWithFavorites all missing → event_not_found", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.createGroupWithEventsForUser).mockResolvedValue({
      status: "event_not_found",
    });

    await expect(
      createGroupWithFavorites("Week-end", ["missing"]),
    ).resolves.toEqual({
      ok: false,
      reason: "event_not_found",
    });
  });
});
