import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/infrastructure/auth/auth";
import {
  deleteAccountOpsUnavailableResponse,
  isDeleteUserCallbackPath,
  isDeleteUserRequestPath,
  runDeleteUserPostWithCredentialGate,
  shouldBlockDeleteAccountBeforeAuth,
} from "@/infrastructure/auth/delete-account-request-guard";
import { finalizeDeleteUserCallbackResponse } from "@/infrastructure/auth/finalize-delete-user-callback-response";
import {
  emailVerificationOpsUnavailableResponse,
  isEmailSignUpRequestPath,
  isSendVerificationEmailRequestPath,
  runEmailVerificationRequestWithSendProbe,
  shouldBlockEmailVerificationBeforeAuth,
} from "@/infrastructure/auth/email-verification-request-guard";
import {
  isPasswordResetRequestPath,
  passwordResetOpsUnavailableResponse,
  runPasswordResetRequestWithSendProbe,
  shouldBlockPasswordResetBeforeAuth,
} from "@/infrastructure/auth/password-reset-request-guard";
import { getPool } from "@/infrastructure/db/postgres";
import { userHasCredentialPassword } from "@/infrastructure/db/user-has-credential-password";

const handlers = toNextJsHandler(auth);

/**
 * Pas de `advanced.backgroundTasks.handler` Better Auth : les envois Resend
 * restent await dans la requête (évite une coupure serverless Vercel avant
 * la fin de l’appel). Les erreurs d’envoi sont reprises via la sonde car BA
 * les avale dans `runInBackgroundOrAwait` (reset, signup, sendOnSignIn,
 * delete-user).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isDeleteUserCallbackPath(url.pathname)) {
    return handlers.GET(request);
  }

  const response = await handlers.GET(request);
  // BA 1.7.4 : succès → 3xx vers callbackURL + Set-Cookie session.
  // Recopie les cookies BA et pose un flash (pas de `status=success` forgeable).
  return finalizeDeleteUserCallbackResponse(response, url.origin);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isPasswordResetRequestPath(pathname)) {
    if (shouldBlockPasswordResetBeforeAuth()) {
      console.error(
        "[detour:auth] password-reset blocked: Resend unavailable or not configured",
      );
      return passwordResetOpsUnavailableResponse();
    }
    return runPasswordResetRequestWithSendProbe(() => handlers.POST(request));
  }

  if (
    isEmailSignUpRequestPath(pathname) ||
    isSendVerificationEmailRequestPath(pathname)
  ) {
    if (shouldBlockEmailVerificationBeforeAuth()) {
      console.error(
        "[detour:auth] email-verification blocked: Resend unavailable or not configured",
      );
      return emailVerificationOpsUnavailableResponse();
    }
    return runEmailVerificationRequestWithSendProbe(() =>
      handlers.POST(request),
    );
  }

  if (isDeleteUserRequestPath(pathname)) {
    if (shouldBlockDeleteAccountBeforeAuth()) {
      console.error(
        "[detour:auth] delete-account blocked: Resend unavailable or not configured",
      );
      return deleteAccountOpsUnavailableResponse();
    }
    return runDeleteUserPostWithCredentialGate({
      request,
      getSessionUserId: async (requestHeaders) => {
        const session = await auth.api.getSession({
          headers: requestHeaders,
          query: { disableCookieCache: true },
        });
        return session?.user?.id ?? null;
      },
      hasCredentialPassword: (userId) =>
        userHasCredentialPassword(getPool(), userId),
      handleAuth: (preparedRequest) => handlers.POST(preparedRequest),
    });
  }

  return handlers.POST(request);
}
