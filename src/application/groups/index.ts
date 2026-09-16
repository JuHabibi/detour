/**
 * Use cases groupes personnels — thin wrappers ownership-scopés.
 * La sécurité IDOR est dans le SQL repository (user_id session, jamais seul groupId).
 */
export {
  addEventToGroupForUser,
  addEventsToGroupForUser,
  createGroupForUser,
  createGroupWithEventsForUser,
  deleteGroupForUser,
  getGroupWithEventsForUser,
  listGroupSummariesForUser,
  listGroupsForUser,
  MAX_GROUP_NAME_LENGTH,
  normalizeEventIds,
  normalizeGroupName,
  removeEventFromGroupForUser,
  renameGroupForUser,
  type AddEventToGroupResult,
  type AddEventsToGroupResult,
  type CreateGroupWithEventsResult,
  type GroupRow,
  type GroupSummary,
  type GroupWithEvents,
} from "@/infrastructure/db/group.repository";
