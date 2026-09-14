import "server-only";

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "@/infrastructure/db/postgres";

function resolveAuthBaseUrl(): string {
  const explicit =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

const secret = process.env.BETTER_AUTH_SECRET?.trim();
const isProductionRuntime =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

if (!secret && isProductionRuntime) {
  throw new Error("BETTER_AUTH_SECRET is required in production");
}

export const auth = betterAuth({
  database: getPool(),
  secret: secret || "dev-only-better-auth-secret-change-me",
  baseURL: resolveAuthBaseUrl(),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
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
  plugins: [nextCookies()],
});
