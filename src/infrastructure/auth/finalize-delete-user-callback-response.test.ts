import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETED_CALLBACK_PATH,
  ACCOUNT_DELETED_FLASH_COOKIE,
} from "@/features/account/components/auth/account-deleted-path";
import { finalizeDeleteUserCallbackResponse } from "@/infrastructure/auth/finalize-delete-user-callback-response";

const ORIGIN = "http://localhost:3000";

function setCookieValues(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

describe("finalizeDeleteUserCallbackResponse", () => {
  it("succès BA 3xx vers callback AccountDangerZone : conserve Set-Cookie BA + flash", () => {
    // Exactement le callbackURL de AccountDangerZone.
    const ba = new Response(null, {
      status: 302,
      headers: {
        Location: ACCOUNT_DELETED_CALLBACK_PATH,
        "Set-Cookie":
          "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
      },
    });

    const next = finalizeDeleteUserCallbackResponse(ba, ORIGIN);
    expect(next.status).toBe(302);
    expect(next.headers.get("Location")).toBe(
      `${ORIGIN}${ACCOUNT_DELETED_CALLBACK_PATH}`,
    );

    const cookies = setCookieValues(next);
    expect(cookies.some((c) => c.includes("better-auth.session_token="))).toBe(
      true,
    );
    expect(
      cookies.some((c) => c.startsWith(`${ACCOUNT_DELETED_FLASH_COOKIE}=1`)),
    ).toBe(true);
  });

  it("ne traite pas Location ?status=success comme seule preuve : flash toujours posé", () => {
    const ba = new Response(null, {
      status: 302,
      headers: {
        Location: "/account/deleted?status=success",
      },
    });
    const next = finalizeDeleteUserCallbackResponse(ba, ORIGIN);
    const cookies = setCookieValues(next);
    expect(
      cookies.some((c) => c.startsWith(`${ACCOUNT_DELETED_FLASH_COOKIE}=1`)),
    ).toBe(true);
  });

  it("échec BA : redirect invalid sans flash", () => {
    const ba = Response.json(
      { message: "Invalid token", code: "INVALID_TOKEN" },
      { status: 404 },
    );
    const next = finalizeDeleteUserCallbackResponse(ba, ORIGIN);
    expect(next.status).toBe(307);
    expect(next.headers.get("Location")).toBe(
      `${ORIGIN}/account/deleted?status=invalid`,
    );
    const cookies = setCookieValues(next);
    expect(
      cookies.some((c) => c.includes(ACCOUNT_DELETED_FLASH_COOKIE)),
    ).toBe(false);
  });

  it("succès JSON sans callbackURL : redirect /account/deleted + flash + cookies BA", () => {
    const ba = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "Set-Cookie":
          "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
      },
    });
    const next = finalizeDeleteUserCallbackResponse(ba, ORIGIN);
    expect(next.headers.get("Location")).toBe(
      `${ORIGIN}${ACCOUNT_DELETED_CALLBACK_PATH}`,
    );
    const cookies = setCookieValues(next);
    expect(cookies.some((c) => c.includes("better-auth.session_token="))).toBe(
      true,
    );
    expect(
      cookies.some((c) => c.startsWith(`${ACCOUNT_DELETED_FLASH_COOKIE}=1`)),
    ).toBe(true);
  });
});
