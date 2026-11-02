import { safeAccountNextPath } from "@/lib/safe-account-next-path";

/**
 * `callbackURL` du lien Better Auth verify-email.
 * Succès → cette page (sans session) ; erreur → `?error=` append par BA.
 */
export function accountVerifyEmailCallbackPath(next?: string | null): string {
  const params = new URLSearchParams();
  params.set("confirmed", "1");
  const safeNext = safeAccountNextPath(next ?? null, "/account");
  if (safeNext !== "/account") {
    params.set("next", safeNext);
  }
  return `/account/verify-email?${params.toString()}`;
}

export function accountVerifyEmailPageHref(input: {
  email?: string | null;
  next?: string | null;
  error?: string | null;
}): string {
  const params = new URLSearchParams();
  const email = input.email?.trim();
  if (email) params.set("email", email);
  const safeNext = safeAccountNextPath(input.next ?? null, "");
  if (safeNext && safeNext !== "/account") {
    params.set("next", safeNext);
  }
  const error = input.error?.trim();
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/account/verify-email?${query}` : "/account/verify-email";
}
