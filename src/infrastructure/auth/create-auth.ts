import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createSendResetPassword } from "@/infrastructure/auth/create-send-reset-password";
import { createSendVerificationEmail } from "@/infrastructure/auth/create-send-verification-email";
import { readGoogleOAuthCredentials } from "@/infrastructure/auth/google-oauth";

/**
 * En-têtes IP fournis / normalisés par Vercel.
 * Better Auth 1.7.4 n’accepte une chaîne multi-valeurs (ex. X-Forwarded-For)
 * que si `trustedProxies` est configuré — on ne le fait pas ici.
 * Localement, sans ces en-têtes, Better Auth retombe sur 127.0.0.1 en
 * development / test.
 */
export const AUTH_IP_ADDRESS_HEADERS = [
  "x-vercel-forwarded-for",
  "x-real-ip",
] as const;

export type CreateAuthOptions = {
  database: NonNullable<BetterAuthOptions["database"]>;
  secret?: string;
  baseURL?: string;
  rateLimit?: BetterAuthOptions["rateLimit"];
  plugins?: BetterAuthOptions["plugins"];
  emailAndPassword?: BetterAuthOptions["emailAndPassword"];
  emailVerification?: BetterAuthOptions["emailVerification"];
  socialProviders?: BetterAuthOptions["socialProviders"];
  account?: BetterAuthOptions["account"];
  /**
   * Après confirmation email : révoquer les sessions du user pour imposer
   * une connexion classique (`autoSignInAfterVerification: false`).
   */
  revokeUserSessionsAfterEmailVerification?: (
    userId: string,
  ) => Promise<void>;
};

function resolveAuthBaseUrl(): string {
  const explicit =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }
  return "http://localhost:3002";
}

function resolveSocialProviders(
  override?: BetterAuthOptions["socialProviders"],
): BetterAuthOptions["socialProviders"] | undefined {
  if (override !== undefined) return override;
  const google = readGoogleOAuthCredentials();
  if (!google) return undefined;
  return {
    google: {
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      prompt: "select_account",
    },
  };
}

/**
 * Factory Better Auth — rate limiting natif partagé via PostgreSQL
 * (`rateLimit.storage: "database"`). Pas de customStorage / Redis.
 *
 * Google OAuth : activé seulement si `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
 * sont présents. Liaison implicite désactivée — pas de fusion silencieuse
 * avec un compte email existant (`account_not_linked`).
 *
 * Vérification email (comptes credential) : obligatoire avant session ;
 * `sendOnSignUp` non forcé à `true` pour ne pas impacter Google.
 */
export function createAuth(options: CreateAuthOptions) {
  const secret =
    options.secret?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "dev-only-better-auth-secret-change-me";

  const socialProviders = resolveSocialProviders(options.socialProviders);

  const revokeAfterVerification =
    options.revokeUserSessionsAfterEmailVerification;

  return betterAuth({
    database: options.database,
    secret,
    baseURL: options.baseURL ?? resolveAuthBaseUrl(),
    advanced: {
      database: {
        generateId: "uuid",
      },
      ipAddress: {
        ipAddressHeaders: [...AUTH_IP_ADDRESS_HEADERS],
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
      },
    },
    emailAndPassword: options.emailAndPassword ?? {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      // Jeton verification `reset-password:*` : 1 h, consommé une fois
      // (`consumeVerificationValue`) au POST /reset-password.
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // Await synchrone (pas de backgroundTasks.handler) — voir route auth.
      sendResetPassword: createSendResetPassword(),
    },
    emailVerification: options.emailVerification ?? {
      sendVerificationEmail: createSendVerificationEmail(),
      // undefined → suit requireEmailVerification (signup email seulement).
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      afterEmailVerification: async (user) => {
        if (!revokeAfterVerification) return;
        try {
          await revokeAfterVerification(user.id);
        } catch (error) {
          // Ne pas avaler : sinon emailVerified=true + vieille session = accès
          // sans connexion classique. BA a déjà persisté emailVerified ; l’échec
          // doit remonter pour éviter un redirect « confirmé » trompeur.
          console.error(
            "[detour:auth] failed to revoke sessions after email verification",
            { code: "SESSION_REVOKE_FAILED" },
          );
          throw error;
        }
      },
    },
    socialProviders,
    account: options.account ?? {
      accountLinking: {
        enabled: true,
        // Pas de fusion auto email↔Google à la connexion (évite takeover /
        // doublons métier). Collision → `account_not_linked` + message UI.
        disableImplicitLinking: true,
      },
    },
    rateLimit: {
      storage: "database",
      ...options.rateLimit,
    },
    plugins: options.plugins ?? [nextCookies()],
  });
}
