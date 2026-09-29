import "server-only";

import type { AccountAuthState } from "@/features/account/account-auth-state";
import { auth } from "@/infrastructure/auth/auth";
import { headers } from "next/headers";


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
