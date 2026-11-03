import type { AccountDeletedStatus } from "@/features/account/components/AccountDeleted";
import { ACCOUNT_DELETED_FLASH_COOKIE } from "@/features/account/components/auth/account-deleted-path";

export function isAccountDeletedFlashActive(
  flashValue: string | undefined,
): boolean {
  return flashValue === "1";
}

/**
 * Résout le statut d’affichage. Si le flash est actif, `onConsume` doit être
 * appelé une fois (middleware : Set-Cookie maxAge=0) pour un usage unique.
 */
export function resolveAccountDeletedStatus(input: {
  flashValue: string | undefined;
  statusParam: string | undefined;
  onConsume: () => void;
}): AccountDeletedStatus {
  if (isAccountDeletedFlashActive(input.flashValue)) {
    input.onConsume();
    return "success";
  }
  if (input.statusParam === "invalid") return "invalid";
  return "unknown";
}

/** Options pour effacer uniquement le flash — jamais les cookies Better Auth. */
export function accountDeletedFlashClearCookieOptions(secure: boolean): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: 0;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure,
  };
}

export function applyAccountDeletedFlashConsumption(input: {
  flashValue: string | undefined;
  clearFlash: () => void;
}): AccountDeletedStatus {
  return resolveAccountDeletedStatus({
    flashValue: input.flashValue,
    statusParam: undefined,
    onConsume: input.clearFlash,
  });
}

export { ACCOUNT_DELETED_FLASH_COOKIE };
