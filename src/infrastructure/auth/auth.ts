import "server-only";

import { getPool } from "@/infrastructure/db/postgres";
import { createAuth } from "@/infrastructure/auth/create-auth";

const secret = process.env.BETTER_AUTH_SECRET?.trim();
const isProductionRuntime =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

if (!secret && isProductionRuntime) {
  throw new Error("BETTER_AUTH_SECRET is required in production");
}

export const auth = createAuth({
  database: getPool(),
  secret: secret || "dev-only-better-auth-secret-change-me",
});
