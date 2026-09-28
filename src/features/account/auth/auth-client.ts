"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client Better Auth pour les formulaires Account (HTTP `/api/auth/...`).
 * Garde le rate limiting Better Auth ; pas de logique métier ici.
 */
export const authClient = createAuthClient();
