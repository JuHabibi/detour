import type { EventGroupMembership } from "@/application/groups";

/** eventId → nombre de carnets distincts (badge Radar / Explorer). */
export function countCarnetsByEventId(
  memberships: EventGroupMembership[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of memberships) {
    counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + 1);
  }
  return counts;
}
