/**
 * Use cases groupes personnels — thin wrappers ownership-scopés.
 * La sécurité IDOR est dans le SQL repository (user_id session, jamais seul groupId).
 *
 * Constantes client-safe : importer depuis `@/application/groups/limits`
 * (évite de tirer `server-only` / pg dans le bundle client).
 */
export {
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUPS_PER_USER,
} from "@/application/groups/limits";

export {
  addEventToGroupForUser,
  addEventsToGroupForUser,
  createGroupForUser,
  createGroupWithEventsForUser,
  deleteGroupForUser,
  getGroupWithEventsForUser,
  listEventGroupMembershipsForUser,
  listGroupSummariesForUser,
  listGroupsForUser,
  normalizeEventIds,
  normalizeGroupName,
  removeEventFromGroupForUser,
  removeEventsFromGroupForUser,
  renameGroupForUser,
  type AddEventToGroupResult,
  type AddEventsToGroupResult,
  type CreateGroupForUserResult,
  type CreateGroupWithEventsResult,
  type EventGroupMembership,
  type GroupRow,
  type GroupSummary,
  type GroupWithEvents,
  type RemoveEventsFromGroupResult,
} from "@/infrastructure/db/group.repository";
