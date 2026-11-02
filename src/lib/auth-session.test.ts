import { describe, expect, it } from "vitest";
import {
  isVerifiedAuthUser,
  verifiedAuthUserId,
} from "@/lib/auth-session";

describe("auth-session", () => {
  it("exige emailVerified === true", () => {
    expect(isVerifiedAuthUser({ id: "u1", emailVerified: true })).toBe(true);
    expect(isVerifiedAuthUser({ id: "u1", emailVerified: false })).toBe(false);
    expect(isVerifiedAuthUser({ id: "u1", emailVerified: null })).toBe(false);
    expect(isVerifiedAuthUser({ id: "u1" })).toBe(false);
    expect(isVerifiedAuthUser(null)).toBe(false);
  });

  it("verifiedAuthUserId ignore les sessions non vérifiées", () => {
    expect(
      verifiedAuthUserId({
        user: { id: "u1", emailVerified: true },
      }),
    ).toBe("u1");
    expect(
      verifiedAuthUserId({
        user: { id: "u1", emailVerified: false },
      }),
    ).toBeNull();
    expect(verifiedAuthUserId(null)).toBeNull();
  });
});
