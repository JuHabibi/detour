import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETED_FLASH_COOKIE } from "@/features/account/components/auth/account-deleted-path";
import { middleware } from "@/middleware";

describe("middleware — flash account deleted à usage unique", () => {
  it("1er passage : laisse le cookie requête intact et l’efface en réponse", () => {
    const request = new NextRequest("http://localhost/account/deleted", {
      headers: {
        cookie: `${ACCOUNT_DELETED_FLASH_COOKIE}=1; better-auth.session_token=abc`,
      },
    });

    const response = middleware(request);
    expect(request.cookies.get(ACCOUNT_DELETED_FLASH_COOKIE)?.value).toBe("1");

    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    const flashClear = setCookies.find((c) =>
      c.startsWith(`${ACCOUNT_DELETED_FLASH_COOKIE}=`),
    );
    expect(flashClear).toBeTruthy();
    expect(flashClear).toMatch(/Max-Age=0/i);
    expect(
      setCookies.some((c) => c.includes("better-auth.session_token")),
    ).toBe(false);
  });

  it("rechargement sans flash : pas de Set-Cookie flash", () => {
    const request = new NextRequest("http://localhost/account/deleted");
    const response = middleware(request);
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    expect(
      setCookies.some((c) => c.includes(ACCOUNT_DELETED_FLASH_COOKIE)),
    ).toBe(false);
  });
});
