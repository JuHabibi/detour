import { createGroupWithEventCarnetMemberships } from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import {
  adjustGroupCountsForMembershipDeltas,
  applyEventMembershipDeltas,
} from "@/components/carnets/replace-event-memberships";

export type SubmitCreateCarnetMembershipsResult =
  | {
      ok: true;
      created: GroupSummary;
      groups: GroupSummary[];
      memberships: EventGroupMembership[];
    }
  | { ok: false; message: string };

function errorMessage(
  reason:
    | "unauthenticated"
    | "invalid"
    | "not_found"
    | "event_not_found"
    | "limit_reached"
    | "error",
): string {
  if (reason === "limit_reached") {
    return "Vous avez atteint la limite de 4 carnets.";
  }
  if (reason === "invalid") {
    return "Indiquez un nom de carnet.";
  }
  if (reason === "unauthenticated") {
    return "Connectez-vous pour ranger cette découverte.";
  }
  if (reason === "not_found" || reason === "event_not_found") {
    return "Impossible d’ajouter à ce carnet.";
  }
  return "Impossible de créer. Réessayez.";
}

/**
 * Création atomique d’un carnet + deltas locaux (appartenances non touchées préservées).
 */
export async function submitCreateCarnetMemberships(params: {
  name: string;
  eventIds: string[];
  addGroupIds: string[];
  removeGroupIds: string[];
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
}): Promise<SubmitCreateCarnetMembershipsResult> {
  try {
    const result = await createGroupWithEventCarnetMemberships(
      params.name,
      params.eventIds,
      params.addGroupIds,
      params.removeGroupIds,
    );
    if (!result.ok) {
      return { ok: false, message: errorMessage(result.reason) };
    }

    const created: GroupSummary = {
      ...result.group,
      eventCount: params.eventIds.length,
      earliestStartAt: null,
      latestStartAt: null,
    };

    const addGroups = [
      { groupId: created.id, groupName: created.name },
      ...params.groups
        .filter((group) => params.addGroupIds.includes(group.id))
        .map((group) => ({ groupId: group.id, groupName: group.name })),
    ];

    const adjustedExisting = adjustGroupCountsForMembershipDeltas(
      params.groups,
      params.memberships,
      params.eventIds,
      params.addGroupIds,
      params.removeGroupIds,
    );

    return {
      ok: true,
      created,
      groups: [created, ...adjustedExisting],
      memberships: applyEventMembershipDeltas(
        params.memberships,
        params.eventIds,
        addGroups,
        params.removeGroupIds,
      ),
    };
  } catch {
    return { ok: false, message: "Impossible de créer. Réessayez." };
  }
}
