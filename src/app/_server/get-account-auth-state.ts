import "server-only";

import type { AccountAuthState } from "@/features/account/account-auth-state";
import { auth } from "@/infrastructure/auth/auth";
import { headers } from "next/headers";

/**
 * Session Better Auth (Next headers) → DTO plat pour les pages Account.
 * Boundary app : compose infrastructure + features DTO.
 */
export async function getAccountAuthState(): Promise<AccountAuthState> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

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
