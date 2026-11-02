import "server-only";

import type { Pool } from "pg";

/**
 * Révoque toutes les sessions d’un utilisateur (après confirmation email).
 * Force une connexion classique ; ne touche pas aux favoris / carnets / user.
 */
export async function revokeAllSessionsForUser(
  pool: Pool,
  userId: string,
): Promise<void> {
  await pool.query(`DELETE FROM "session" WHERE "userId" = $1`, [userId]);
}
