import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";

vi.mock("@/app/actions/groups", () => ({
  createGroupWithEventCarnetMemberships: vi.fn(),
}));

import { createGroupWithEventCarnetMemberships } from "@/app/actions/groups";
import { submitCreateCarnetMemberships } from "@/components/carnets/submit-create-carnet-memberships";

const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GROUP_NEW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function group(
  partial: Partial<GroupSummary> & Pick<GroupSummary, "id" | "name">,
): GroupSummary {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-09-16T10:00:00.000Z",
    updatedAt: "2026-09-16T10:00:00.000Z",
    eventCount: 0,
    earliestStartAt: null,
    latestStartAt: null,
    ...partial,
  };
}

describe("submitCreateCarnetMemberships", () => {
  const groups = [
    group({ id: GROUP_A, name: "A", eventCount: 1 }),
    group({ id: GROUP_B, name: "B", eventCount: 0 }),
  ];
  const memberships: EventGroupMembership[] = [
    { eventId: "e1", groupId: GROUP_A, groupName: "A" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succès : un appel + deltas (A partiel préservé)", async () => {
    vi.mocked(createGroupWithEventCarnetMemberships).mockResolvedValue({
      ok: true,
      group: {
        id: GROUP_NEW,
        userId: "11111111-1111-4111-8111-111111111111",
        name: "Nouveau",
        createdAt: "2026-10-03T10:00:00.000Z",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    });

    const result = await submitCreateCarnetMemberships({
      name: "Nouveau",
      eventIds: ["e1", "e2"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      groups,
      memberships,
    });

    expect(createGroupWithEventCarnetMemberships).toHaveBeenCalledWith(
      "Nouveau",
      ["e1", "e2"],
      [GROUP_B],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created.id).toBe(GROUP_NEW);
    expect(result.groups[0]?.id).toBe(GROUP_NEW);
    expect(result.groups.find((g) => g.id === GROUP_A)?.eventCount).toBe(1);
    expect(result.groups.find((g) => g.id === GROUP_B)?.eventCount).toBe(2);
    expect(
      result.memberships.filter(
        (m) => m.eventId === "e1" && m.groupId === GROUP_A,
      ),
    ).toHaveLength(1);
    expect(
      result.memberships
        .filter((m) => m.groupId === GROUP_NEW)
        .map((m) => m.eventId)
        .sort(),
    ).toEqual(["e1", "e2"]);
  });

  it("échec puis retry", async () => {
    vi.mocked(createGroupWithEventCarnetMemberships)
      .mockResolvedValueOnce({ ok: false, reason: "error" })
      .mockResolvedValueOnce({
        ok: true,
        group: {
          id: GROUP_NEW,
          userId: "11111111-1111-4111-8111-111111111111",
          name: "Nouveau",
          createdAt: "2026-10-03T10:00:00.000Z",
          updatedAt: "2026-10-03T10:00:00.000Z",
        },
      });

    const first = await submitCreateCarnetMemberships({
      name: "Nouveau",
      eventIds: ["e1"],
      addGroupIds: [],
      removeGroupIds: [],
      groups,
      memberships,
    });
    expect(first).toEqual({
      ok: false,
      message: "Impossible de créer. Réessayez.",
    });

    const second = await submitCreateCarnetMemberships({
      name: "Nouveau",
      eventIds: ["e1"],
      addGroupIds: [],
      removeGroupIds: [],
      groups,
      memberships,
    });
    expect(second.ok).toBe(true);
    expect(createGroupWithEventCarnetMemberships).toHaveBeenCalledTimes(2);
  });

  it("promesse rejetée", async () => {
    vi.mocked(createGroupWithEventCarnetMemberships).mockRejectedValue(
      new Error("network"),
    );

    await expect(
      submitCreateCarnetMemberships({
        name: "Nouveau",
        eventIds: ["e1"],
        addGroupIds: [],
        removeGroupIds: [],
        groups,
        memberships,
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Impossible de créer. Réessayez.",
    });
  });
});
