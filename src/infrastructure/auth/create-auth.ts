import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";

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

/**
 * Factory Better Auth — rate limiting natif partagé via PostgreSQL
 * (`rateLimit.storage: "database"`). Pas de customStorage / Redis.
 */
export function createAuth(options: CreateAuthOptions) {
  const secret =
    options.secret?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "dev-only-better-auth-secret-change-me";

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
      sendResetPassword: async ({ user, url }) => {
        if (process.env.NODE_ENV !== "production") {
          console.info(
            "[detour:auth] reset password (dev stub)",
            user.email,
            url,
          );
          return;
        }
        throw new Error(
          "Password reset email is not configured. Set up an email provider first.",
        );
      },
    },
    rateLimit: {
      storage: "database",
      ...options.rateLimit,
    },
    plugins: options.plugins ?? [nextCookies()],
  });
}
