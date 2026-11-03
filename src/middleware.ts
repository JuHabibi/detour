import { NextResponse, type NextRequest } from "next/server";
import {
  accountDeletedFlashClearCookieOptions,
  isAccountDeletedFlashActive,
} from "@/features/account/components/auth/account-deleted-flash";
import {
  ACCOUNT_DELETED_CALLBACK_PATH,
  ACCOUNT_DELETED_FLASH_COOKIE,
} from "@/features/account/components/auth/account-deleted-path";

/**
 * Consomme le flash `detour_account_deleted` à usage unique.
 * La requête garde le cookie (1er rendu = succès) ; la réponse l’efface
 * (rechargement = plus de succès). Ne touche aucun cookie Better Auth.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const flash = request.cookies.get(ACCOUNT_DELETED_FLASH_COOKIE)?.value;
  if (!isAccountDeletedFlashActive(flash)) return response;

  response.cookies.set(
    ACCOUNT_DELETED_FLASH_COOKIE,
    "",
    accountDeletedFlashClearCookieOptions(
      process.env.NODE_ENV === "production",
    ),
  );
  return response;
}

export const config = {
  // Littéral statique requis par Next.js (pas d’import / constante).
  matcher: "/account/deleted",
};
