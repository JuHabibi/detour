import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";

vi.mock("@/app/actions/groups", () => ({
  applyEventCarnetMemberships: vi.fn(),
}));

import { applyEventCarnetMemberships } from "@/app/actions/groups";
import {
  adjustGroupCountsForMembershipDeltas,
  applyEventMembershipDeltas,
} from "@/components/carnets/replace-event-memberships";
import { submitExistingCarnetMemberships } from "@/components/carnets/submit-existing-carnet-memberships";

const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

describe("applyEventMembershipDeltas (partielles)", () => {
  it("E1 reste dans A quand on ajoute seulement B", () => {
    const memberships: EventGroupMembership[] = [
      { eventId: "e1", groupId: GROUP_A, groupName: "A" },
    ];
    const next = applyEventMembershipDeltas(
      memberships,
      ["e1", "e2"],
      [{ groupId: GROUP_B, groupName: "B" }],
      [],
    );
    expect(next).toEqual([
      { eventId: "e1", groupId: GROUP_A, groupName: "A" },
      { eventId: "e1", groupId: GROUP_B, groupName: "B" },
      { eventId: "e2", groupId: GROUP_B, groupName: "B" },
    ]);
  });

  it("compteurs : +1 réel sur B, A inchangé", () => {
    const groups = [
      group({ id: GROUP_A, name: "A", eventCount: 1 }),
      group({ id: GROUP_B, name: "B", eventCount: 0 }),
    ];
    const memberships: EventGroupMembership[] = [
      { eventId: "e1", groupId: GROUP_A, groupName: "A" },
    ];
    const next = adjustGroupCountsForMembershipDeltas(
      groups,
      memberships,
      ["e1", "e2"],
      [GROUP_B],
      [],
    );
    expect(next.find((g) => g.id === GROUP_A)?.eventCount).toBe(1);
    expect(next.find((g) => g.id === GROUP_B)?.eventCount).toBe(2);
  });
});

describe("submitExistingCarnetMemberships (parcours validate)", () => {
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

  it("succès Organize/Account : un seul appel atomique + état mis à jour", async () => {
    vi.mocked(applyEventCarnetMemberships).mockResolvedValue({ ok: true });

    const result = await submitExistingCarnetMemberships({
      eventIds: ["e1", "e2"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      groups,
      memberships,
    });

    expect(applyEventCarnetMemberships).toHaveBeenCalledTimes(1);
    expect(applyEventCarnetMemberships).toHaveBeenCalledWith(
      ["e1", "e2"],
      [GROUP_B],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.memberships).toEqual([
      { eventId: "e1", groupId: GROUP_A, groupName: "A" },
      { eventId: "e1", groupId: GROUP_B, groupName: "B" },
      { eventId: "e2", groupId: GROUP_B, groupName: "B" },
    ]);
    expect(result.groups.find((g) => g.id === GROUP_A)?.eventCount).toBe(1);
    expect(result.groups.find((g) => g.id === GROUP_B)?.eventCount).toBe(2);
  });

  it("échec retourné : pas d’état mis à jour, nouvelle tentative possible", async () => {
    vi.mocked(applyEventCarnetMemberships)
      .mockResolvedValueOnce({ ok: false, reason: "error" })
      .mockResolvedValueOnce({ ok: true });

    const first = await submitExistingCarnetMemberships({
      eventIds: ["e1"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      groups,
      memberships,
    });
    expect(first).toEqual({
      ok: false,
      message: "Impossible de mettre à jour les carnets. Réessayez.",
    });

    const second = await submitExistingCarnetMemberships({
      eventIds: ["e1"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      groups,
      memberships,
    });
    expect(second.ok).toBe(true);
    expect(applyEventCarnetMemberships).toHaveBeenCalledTimes(2);
  });

  it("promesse rejetée : erreur + retry", async () => {
    vi.mocked(applyEventCarnetMemberships)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true });

    const first = await submitExistingCarnetMemberships({
      eventIds: ["e1"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      groups,
      memberships,
    });
    expect(first).toEqual({
      ok: false,
      message: "Impossible de mettre à jour les carnets. Réessayez.",
    });

    const second = await submitExistingCarnetMemberships({
      eventIds: ["e1"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      groups,
      memberships,
    });
    expect(second.ok).toBe(true);
  });

  it("unauthenticated → message connexion", async () => {
    vi.mocked(applyEventCarnetMemberships).mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    await expect(
      submitExistingCarnetMemberships({
        eventIds: ["e1"],
        addGroupIds: [GROUP_B],
        removeGroupIds: [],
        groups,
        memberships,
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Connectez-vous pour ranger cette découverte.",
    });
  });
});
