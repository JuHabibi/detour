/**
 * Use cases groupes personnels V1 — thin wrappers ownership-scopés.
 * La sécurité IDOR est dans le SQL repository (user_id session, jamais seul groupId).
 */
export {
  addEventToGroupForUser,
  createGroupForUser,
  deleteGroupForUser,
  getGroupWithEventsForUser,
  listGroupsForUser,
  normalizeGroupName,
  removeEventFromGroupForUser,
  renameGroupForUser,
  type AddEventToGroupResult,
  type GroupRow,
  type GroupWithEvents,
} from "@/infrastructure/db/group.repository";
