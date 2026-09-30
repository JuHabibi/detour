import type { EventGroupMembership } from "@/application/groups";

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
