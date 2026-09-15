import "server-only";

import { headers } from "next/headers";
import type { AccountAuthState } from "@/features/account/account-auth-state";
import { auth } from "@/infrastructure/auth/auth";
import { homePerfLog, homePerfTimed } from "@/infrastructure/db/home-perf";

/**
 * Session Better Auth (Next headers) → DTO plat pour les pages Account.
 * Boundary app : compose infrastructure + features DTO.
 */
export async function getAccountAuthState(): Promise<AccountAuthState> {
  const { value: session, ms } = await homePerfTimed(async () =>
    auth.api.getSession({
      headers: await headers(),
    }),
  );
  homePerfLog(
    `db_auth_session=${ms}ms hit=${Boolean(session?.user?.id)}`,
  );

  if (!session?.user?.id || !session.user.email) {
    return { status: "unauthenticated" };
  }

  return {
    status: "authenticated",
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name?.trim() || session.user.email,
    },
  };
}
