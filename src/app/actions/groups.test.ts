import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/application/groups", () => ({
  createGroupForUser: vi.fn(),
  renameGroupForUser: vi.fn(),
  deleteGroupForUser: vi.fn(),
  addEventToGroupForUser: vi.fn(),
  removeEventFromGroupForUser: vi.fn(),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import * as groupsApp from "@/application/groups";
import {
  addFavoriteToGroup,
  createGroup,
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

  it("createGroup nom vide → invalid", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_A, email: "a@exemple.fr", name: "A" },
    });
    vi.mocked(groupsApp.createGroupForUser).mockResolvedValue(null);

    await expect(createGroup("   ")).resolves.toEqual({
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
});
