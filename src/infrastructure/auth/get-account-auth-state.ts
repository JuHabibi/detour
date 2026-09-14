import "server-only";

import { headers } from "next/headers";
import type { AccountAuthState } from "@/features/account/account-auth-state";
import { auth } from "@/infrastructure/auth/auth";

export type { AccountAuthState, AccountAuthUser } from "@/features/account/account-auth-state";

/** Session Better Auth → DTO plat pour la boundary app / features. */
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
