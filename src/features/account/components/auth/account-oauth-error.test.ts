import { describe, expect, it } from "vitest";
import { mapAccountOAuthError } from "@/features/account/components/auth/account-oauth-error";

describe("mapAccountOAuthError", () => {
  it("oriente les collisions email/Google vers Se connecter (sans fusion)", () => {
    const message = mapAccountOAuthError("account_not_linked");
    expect(message).toContain("Un compte existe déjà avec cet email");
    expect(message).toContain("Se connecter");
    expect(message).toContain("mot de passe");
    expect(mapAccountOAuthError("unable_to_link_account")).toBe(message);
    expect(mapAccountOAuthError("email_does_not_match")).toBe(message);
  });

  it("distingue annulation et erreur générique", () => {
    expect(mapAccountOAuthError("access_denied")).toContain("annulée");
    expect(mapAccountOAuthError("user_cancelled")).toContain("annulée");
    expect(mapAccountOAuthError("invalid_code")).toContain("Google");
    expect(mapAccountOAuthError(undefined)).toBeNull();
    expect(mapAccountOAuthError("")).toBeNull();
  });
});
