/**
 * `callbackURL` transmis à Better Auth `deleteUser` (AccountDangerZone).
 * BA 1.7.4 redirige en 3xx vers cette URL après suppression réussie.
 */
export const ACCOUNT_DELETED_CALLBACK_PATH = "/account/deleted";

/** Flash httpOnly posé uniquement par le wrapper GET après succès BA. */
export const ACCOUNT_DELETED_FLASH_COOKIE = "detour_account_deleted";

export const ACCOUNT_DELETED_INVALID_PATH = "/account/deleted?status=invalid";
