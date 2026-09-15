import "server-only";

import {
  homePerfLog,
  homePerfTimed,
  homePerfWithAuthDbProbe,
} from "@/infrastructure/db/home-perf";
import type { AccountAuthState } from "@/features/account/account-auth-state";
import { auth } from "@/infrastructure/auth/auth";
import { headers } from "next/headers";

/**
 * Session Better Auth (Next headers) → DTO plat pour les pages Account.
 * Boundary app : compose infrastructure + features DTO.
 */
export async function getAccountAuthState(): Promise<AccountAuthState> {
  const tTotal = Date.now();

  const {
    value: sessionTimed,
    dbMs,
    dbQueries,
    connectMs,
    sessionRefresh,
  } = await homePerfWithAuthDbProbe(() =>
    homePerfTimed(async () =>
      auth.api.getSession({
        headers: await headers(),
      }),
    ),
  );

  const session = sessionTimed.value;
  const hit = Boolean(session?.user?.id);

  homePerfLog(`auth_db_connect=${connectMs}ms`);
  homePerfLog(`auth_session_refresh=${sessionRefresh}`);
  homePerfLog(
    `auth_session=${sessionTimed.ms}ms auth_db=${dbMs}ms auth_db_queries=${dbQueries} hit=${hit}`,
  );

  const state: AccountAuthState =
    !session?.user?.id || !session.user.email
      ? { status: "unauthenticated" }
      : {
          status: "authenticated",
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name?.trim() || session.user.email,
          },
        };

  homePerfLog(
    `auth_total=${Date.now() - tTotal}ms status=${state.status}`,
  );

  return state;
}
