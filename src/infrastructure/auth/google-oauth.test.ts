import { describe, expect, it } from "vitest";
import {
  googleOAuthCallbackPath,
  isGoogleOAuthConfigured,
  readGoogleOAuthCredentials,
} from "@/infrastructure/auth/google-oauth";

describe("google-oauth credentials", () => {
  it("lit les credentials seulement si id et secret sont non vides", () => {
    expect(
      readGoogleOAuthCredentials({
        GOOGLE_CLIENT_ID: " id.apps.googleusercontent.com ",
        GOOGLE_CLIENT_SECRET: " secret ",
      }),
    ).toEqual({
      clientId: "id.apps.googleusercontent.com",
      clientSecret: "secret",
    });
    expect(
      readGoogleOAuthCredentials({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "",
      }),
    ).toBeNull();
    expect(isGoogleOAuthConfigured({})).toBe(false);
  });

  it("construit le redirect URI Better Auth sans journaliser de secret", () => {
    expect(googleOAuthCallbackPath("https://detour.website/")).toBe(
      "https://detour.website/api/auth/callback/google",
    );
    expect(googleOAuthCallbackPath("http://localhost:3002")).toBe(
      "http://localhost:3002/api/auth/callback/google",
    );
  });
});
