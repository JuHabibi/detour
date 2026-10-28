import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/infrastructure/auth/auth";
import {
  isPasswordResetRequestPath,
  passwordResetOpsUnavailableResponse,
  runPasswordResetRequestWithSendProbe,
  shouldBlockPasswordResetBeforeAuth,
} from "@/infrastructure/auth/password-reset-request-guard";

const handlers = toNextJsHandler(auth);

/**
 * Pas de `advanced.backgroundTasks.handler` Better Auth : l’envoi reset
 * reste await dans la requête (évite une coupure serverless Vercel avant
 * la fin de l’appel Resend). Les erreurs d’envoi sont reprises via la sonde
 * car BA les avale dans `runInBackgroundOrAwait`.
 */
export const { GET } = handlers;

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!isPasswordResetRequestPath(url.pathname)) {
    return handlers.POST(request);
  }

  if (shouldBlockPasswordResetBeforeAuth()) {
    console.error(
      "[detour:auth] password-reset blocked: Resend unavailable or not configured",
    );
    return passwordResetOpsUnavailableResponse();
  }

  return runPasswordResetRequestWithSendProbe(() => handlers.POST(request));
}
