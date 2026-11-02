import "server-only";

/**
 * Credentials Google OAuth — server-only.
 * Ne jamais exposer ni journaliser `GOOGLE_CLIENT_SECRET`.
 */

export type GoogleSocialProviderConfig = {
  clientId: string;
  clientSecret: string;
};

type EnvLike = Record<string, string | undefined>;

export function readGoogleOAuthCredentials(
  env: EnvLike = process.env,
): GoogleSocialProviderConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(env: EnvLike = process.env): boolean {
  return readGoogleOAuthCredentials(env) != null;
}

/** Redirect URI Google Cloud = `{BETTER_AUTH_URL}/api/auth/callback/google`. */
export function googleOAuthCallbackPath(baseURL: string): string {
  const origin = baseURL.replace(/\/$/, "");
  return `${origin}/api/auth/callback/google`;
}
