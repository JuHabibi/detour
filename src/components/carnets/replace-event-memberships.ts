import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";

/**
 * Remplace les memberships des eventIds donnés pour un ensemble de carnets cibles.
 * Conserve les memberships des autres events.
 */
export function replaceEventMemberships(
  memberships: EventGroupMembership[],
  eventIds: string[],
  selectedGroups: { groupId: string; groupName: string }[],
): EventGroupMembership[] {
  const eventSet = new Set(eventIds);
  const kept = memberships.filter((row) => !eventSet.has(row.eventId));
  const next: EventGroupMembership[] = [...kept];
  for (const eventId of eventIds) {
    for (const group of selectedGroups) {
      next.push({
        eventId,
        groupId: group.groupId,
        groupName: group.groupName,
      });
    }
  }
  return next;
}

/**
 * Applique des ajouts/retraits explicites — préserve les appartenances
 * partielles des carnets non listés (ex. E1 reste dans A si A n’est pas touché).
 */
export function applyEventMembershipDeltas(
  memberships: EventGroupMembership[],
  eventIds: string[],
  addGroups: { groupId: string; groupName: string }[],
  removeGroupIds: string[],
): EventGroupMembership[] {
  const eventSet = new Set(eventIds);
  const removeSet = new Set(removeGroupIds);
  const next = memberships.filter(
    (row) => !(eventSet.has(row.eventId) && removeSet.has(row.groupId)),
  );
  for (const eventId of eventIds) {
    for (const group of addGroups) {
      if (
        !next.some(
          (row) => row.eventId === eventId && row.groupId === group.groupId,
        )
      ) {
        next.push({
          eventId,
          groupId: group.groupId,
          groupName: group.groupName,
        });
      }
    }
  }
  return next;
}

/** Ajuste eventCount selon les memberships réellement ajoutées / retirées. */
export function adjustGroupCountsForMembershipDeltas(
  groups: GroupSummary[],
  memberships: EventGroupMembership[],
  eventIds: string[],
  addGroupIds: string[],
  removeGroupIds: string[],
): GroupSummary[] {
  const eventSet = new Set(eventIds);
  const addSet = new Set(addGroupIds);
  const removeSet = new Set(removeGroupIds);
  return groups.map((group) => {
    if (addSet.has(group.id)) {
      const alreadyIn = memberships.filter(
        (m) => m.groupId === group.id && eventSet.has(m.eventId),
      ).length;
      const added = eventIds.length - alreadyIn;
      return {
        ...group,
        eventCount: group.eventCount + Math.max(0, added),
      };
    }
    if (removeSet.has(group.id)) {
      const removed = memberships.filter(
        (m) => m.groupId === group.id && eventSet.has(m.eventId),
      ).length;
      return {
        ...group,
        eventCount: Math.max(0, group.eventCount - removed),
      };
    }
    return group;
  });
}
