import "server-only";

import type { Pool } from "pg";

/**
 * Jetons `verification` liés à un user :
 * - `reset-password:${token}` → value = userId
 * - `delete-account-${token}` → value = userId
 * (La vérif email credential est un JWT — pas de ligne verification.)
 *
 * Ciblage strict : uniquement `value = userId` (uuid), pas de LIKE email.
 */
export async function deleteVerificationTokensForUser(
  pool: Pool,
  userId: string,
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM "verification" WHERE value = $1`,
    [userId],
  );
  return result.rowCount ?? 0;
}
