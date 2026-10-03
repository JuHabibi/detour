import { applyEventCarnetMemberships } from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import {
  adjustGroupCountsForMembershipDeltas,
  applyEventMembershipDeltas,
} from "@/components/carnets/replace-event-memberships";

export type SubmitExistingCarnetMembershipsResult =
  | {
      ok: true;
      groups: GroupSummary[];
      memberships: EventGroupMembership[];
    }
  | { ok: false; message: string };

/**
 * Validation des carnets existants : un seul appel atomique + état local
 * mis à jour par deltas explicites (pas de remplacement global).
 */
export async function submitExistingCarnetMemberships(params: {
  eventIds: string[];
  addGroupIds: string[];
  removeGroupIds: string[];
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
}): Promise<SubmitExistingCarnetMembershipsResult> {
  try {
    const result = await applyEventCarnetMemberships(
      params.eventIds,
      params.addGroupIds,
      params.removeGroupIds,
    );
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "unauthenticated"
            ? "Connectez-vous pour ranger cette découverte."
            : "Impossible de mettre à jour les carnets. Réessayez.",
      };
    }

    const addGroups = params.groups
      .filter((group) => params.addGroupIds.includes(group.id))
      .map((group) => ({ groupId: group.id, groupName: group.name }));

    return {
      ok: true,
      memberships: applyEventMembershipDeltas(
        params.memberships,
        params.eventIds,
        addGroups,
        params.removeGroupIds,
      ),
      groups: adjustGroupCountsForMembershipDeltas(
        params.groups,
        params.memberships,
        params.eventIds,
        params.addGroupIds,
        params.removeGroupIds,
      ),
    };
  } catch {
    return {
      ok: false,
      message: "Impossible de mettre à jour les carnets. Réessayez.",
    };
  }
}
