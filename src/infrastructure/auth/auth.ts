import "server-only";

import { getPool } from "@/infrastructure/db/postgres";
import { createAuth } from "@/infrastructure/auth/create-auth";
import { deleteVerificationTokensForUser } from "@/infrastructure/auth/delete-user-verification-cleanup";
import { revokeAllSessionsForUser } from "@/infrastructure/auth/revoke-user-sessions";

const secret = process.env.BETTER_AUTH_SECRET?.trim();
const isProductionRuntime =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

if (!secret && isProductionRuntime) {
  throw new Error("BETTER_AUTH_SECRET is required in production");
}

export const auth = createAuth({
  database: getPool(),
  secret: secret || "dev-only-better-auth-secret-change-me",
  revokeUserSessionsAfterEmailVerification: async (userId) => {
    await revokeAllSessionsForUser(getPool(), userId);
  },
  cleanupVerificationTokensBeforeUserDelete: async (userId) => {
    await deleteVerificationTokensForUser(getPool(), userId);
  },
});
