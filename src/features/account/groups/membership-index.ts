import type { EventGroupMembership } from "@/application/groups";

export type FavoriteFilter =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "group"; groupId: string };

export type CarnetBadge = {
  groupId: string;
  groupName: string;
  toneIndex: number;
};

/** eventId → carnets (ordre stable de la liste memberships). */
export function buildMembershipMap(
  memberships: EventGroupMembership[],
  groupOrder: readonly { id: string }[],
): Map<string, CarnetBadge[]> {
  const toneByGroup = new Map(
    groupOrder.map((g, index) => [g.id, index] as const),
  );
  const map = new Map<string, CarnetBadge[]>();
  for (const row of memberships) {
    const list = map.get(row.eventId) ?? [];
    list.push({
      groupId: row.groupId,
      groupName: row.groupName,
      toneIndex: toneByGroup.get(row.groupId) ?? 0,
    });
    map.set(row.eventId, list);
  }
  return map;
}

export function eventIdsInGroup(
  memberships: EventGroupMembership[],
  groupId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const row of memberships) {
    if (row.groupId === groupId) ids.add(row.eventId);
  }
  return ids;
}

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

export function countFavoritesWithoutCarnet(
  favoriteIds: string[],
  memberships: EventGroupMembership[],
): number {
  if (favoriteIds.length === 0) return 0;
  const withCarnet = new Set(memberships.map((m) => m.eventId));
  return favoriteIds.reduce(
    (n, id) => n + (withCarnet.has(id) ? 0 : 1),
    0,
  );
}

export function countFavoritesInGroup(
  favoriteIds: string[],
  memberships: EventGroupMembership[],
  groupId: string,
): number {
  if (favoriteIds.length === 0) return 0;
  const inGroup = eventIdsInGroup(memberships, groupId);
  return favoriteIds.reduce((n, id) => n + (inGroup.has(id) ? 1 : 0), 0);
}

export function filterFavoriteIds(
  favoriteIds: string[],
  memberships: EventGroupMembership[],
  filter: FavoriteFilter,
): string[] {
  if (filter.kind === "all") return favoriteIds;
  if (filter.kind === "none") {
    const withCarnet = new Set(memberships.map((m) => m.eventId));
    return favoriteIds.filter((id) => !withCarnet.has(id));
  }
  const inGroup = eventIdsInGroup(memberships, filter.groupId);
  return favoriteIds.filter((id) => inGroup.has(id));
}

/** Après rename : met à jour groupName dans les memberships. */
export function renameMemberships(
  memberships: EventGroupMembership[],
  groupId: string,
  groupName: string,
): EventGroupMembership[] {
  return memberships.map((row) =>
    row.groupId === groupId ? { ...row, groupName } : row,
  );
}

/** Après delete carnet. */
export function dropGroupMemberships(
  memberships: EventGroupMembership[],
  groupId: string,
): EventGroupMembership[] {
  return memberships.filter((row) => row.groupId !== groupId);
}

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
