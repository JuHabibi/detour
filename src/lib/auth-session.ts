/**
 * Session considérée authentifiée pour Détour seulement si l’email est vérifié.
 * Better Auth peut encore renvoyer un cookie/session pour un compte non vérifié
 * (sessions historiques, cookie cache 5 min) — l’app ne doit pas les traiter
 * comme un accès privé valide.
 */
export function isVerifiedAuthUser(
  user:
    | {
        id?: string | null;
        emailVerified?: boolean | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(user?.id) && user?.emailVerified === true;
}

export function verifiedAuthUserId(
  session:
    | {
        user?: {
          id?: string | null;
          emailVerified?: boolean | null;
        } | null;
      }
    | null
    | undefined,
): string | null {
  const user = session?.user;
  if (!isVerifiedAuthUser(user)) return null;
  return user!.id as string;
}
