import { describe, expect, it } from "vitest";
import { mapAccountOAuthError } from "@/features/account/components/auth/account-oauth-error";

describe("mapAccountOAuthError", () => {
  it("oriente les collisions de compte vers le mot de passe", () => {
    expect(mapAccountOAuthError("account_not_linked")).toContain(
      "mot de passe",
    );
    expect(mapAccountOAuthError("unable_to_link_account")).toContain(
      "mot de passe",
    );
  });

  it("distingue annulation et erreur générique", () => {
    expect(mapAccountOAuthError("access_denied")).toContain("annulée");
    expect(mapAccountOAuthError("invalid_code")).toContain("Google");
    expect(mapAccountOAuthError(undefined)).toBeNull();
    expect(mapAccountOAuthError("")).toBeNull();
  });
});
