import "server-only";

import type { AccountAuthState } from "@/features/account/account-auth-state";
import { auth } from "@/infrastructure/auth/auth";
import { isVerifiedAuthUser } from "@/lib/auth-session";
import { headers } from "next/headers";

/**
 * Authz serveur pour pages / server actions compte.
 *
 * - `disableCookieCache: true` : lit `emailVerified` frais en base (le cookie
 *   cache BA compact peut rester périmé jusqu’à 5 min).
 * - Session présente mais email non vérifié → `unauthenticated` (pas d’accès
 *   favoris/carnets). Aucun DELETE massif des sessions historiques : la
 *   régularisation se fait au login + page verify ; révocation ciblée après
 *   confirmation email uniquement.
 */
export async function getAccountAuthState(): Promise<AccountAuthState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: {
      disableCookieCache: true,
    },
  });

  if (!session?.user?.id || !session.user.email) {
    return { status: "unauthenticated" };
  }

  if (!isVerifiedAuthUser(session.user)) {
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
