import "server-only";

import { NextResponse } from "next/server";
import {
  ACCOUNT_DELETED_CALLBACK_PATH,
  ACCOUNT_DELETED_FLASH_COOKIE,
  ACCOUNT_DELETED_INVALID_PATH,
} from "@/features/account/components/auth/account-deleted-path";

function collectSetCookieHeaders(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") {
    const list = response.headers.getSetCookie();
    if (list.length > 0) return list;
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function appendSetCookies(target: Headers, setCookies: string[]): void {
  for (const cookie of setCookies) {
    target.append("Set-Cookie", cookie);
  }
}

/**
 * Post-traitement du GET `/delete-user/callback` Better Auth 1.7.4.
 *
 * BA succès + callbackURL → 3xx Location + Set-Cookie (session effacée).
 * On reconstruit la redirect pour ajouter un flash httpOnly (preuve UX locale),
 * tout en recopiant les Set-Cookie BA. `?status=success` n’est jamais une preuve.
 */
export function finalizeDeleteUserCallbackResponse(
  baResponse: Response,
  requestOrigin: string,
): NextResponse {
  const setCookies = collectSetCookieHeaders(baResponse);
  const secure = process.env.NODE_ENV === "production";

  if (baResponse.status >= 300 && baResponse.status < 400) {
    const location =
      baResponse.headers.get("Location") ?? ACCOUNT_DELETED_CALLBACK_PATH;
    const redirectUrl = new URL(location, requestOrigin);
    const next = NextResponse.redirect(redirectUrl, baResponse.status);
    // `cookies.set` réécrit Set-Cookie : flash d’abord, puis cookies BA.
    next.cookies.set(ACCOUNT_DELETED_FLASH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 120,
      secure,
    });
    appendSetCookies(next.headers, setCookies);
    return next;
  }

  if (baResponse.ok) {
    const next = NextResponse.redirect(
      new URL(ACCOUNT_DELETED_CALLBACK_PATH, requestOrigin),
    );
    next.cookies.set(ACCOUNT_DELETED_FLASH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 120,
      secure,
    });
    appendSetCookies(next.headers, setCookies);
    return next;
  }

  const next = NextResponse.redirect(
    new URL(ACCOUNT_DELETED_INVALID_PATH, requestOrigin),
  );
  appendSetCookies(next.headers, setCookies);
  return next;
}
