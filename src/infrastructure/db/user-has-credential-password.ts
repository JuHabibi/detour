import "server-only";

import type { Pool } from "pg";

/**
 * True si le user a un compte Better Auth `credential` avec mot de passe.
 * Sert à exiger le password dans l’UI de suppression (multi-providers inclus).
 */
export async function userHasCredentialPassword(
  pool: Pool,
  userId: string,
): Promise<boolean> {
  const result = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM "account"
     WHERE "userId" = $1
       AND "providerId" = 'credential'
       AND password IS NOT NULL
     LIMIT 1`,
    [userId],
  );
  return result.rowCount === 1;
}
