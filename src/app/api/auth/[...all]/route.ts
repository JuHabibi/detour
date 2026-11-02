import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/infrastructure/auth/auth";
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

const handlers = toNextJsHandler(auth);

/**
 * Pas de `advanced.backgroundTasks.handler` Better Auth : les envois Resend
 * restent await dans la requête (évite une coupure serverless Vercel avant
 * la fin de l’appel). Les erreurs d’envoi sont reprises via la sonde car BA
 * les avale dans `runInBackgroundOrAwait` (reset, signup, sendOnSignIn).
 */
export const { GET } = handlers;

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

  return handlers.POST(request);
}
