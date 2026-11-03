import { describe, expect, it } from "vitest";
import {
  DELETE_ACCOUNT_GENERIC_ERROR,
  DELETE_ACCOUNT_INVALID_PASSWORD,
  DELETE_ACCOUNT_OPS_ERROR,
  mapDeleteAccountClientError,
} from "@/features/account/components/auth/account-delete-feedback";

describe("mapDeleteAccountClientError", () => {
  it("mappe les codes connus", () => {
    expect(mapDeleteAccountClientError("INVALID_PASSWORD")).toBe(
      DELETE_ACCOUNT_INVALID_PASSWORD,
    );
    expect(
      mapDeleteAccountClientError("DELETE_ACCOUNT_PROVIDER_UNAVAILABLE"),
    ).toBe(DELETE_ACCOUNT_OPS_ERROR);
    expect(mapDeleteAccountClientError("UNKNOWN")).toBe(
      DELETE_ACCOUNT_GENERIC_ERROR,
    );
  });
});
