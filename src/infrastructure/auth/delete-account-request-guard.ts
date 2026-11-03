import "server-only";

import { resolveResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import {
  isPasswordResetProviderInCooldown,
  passwordResetSendProbe,
  type PasswordResetSendProbe,
} from "@/infrastructure/email/password-reset-send-probe";

export const DELETE_ACCOUNT_OPS_UNAVAILABLE_MESSAGE =
  "Le service de suppression de compte est temporairement indisponible. Réessayez plus tard.";

/** Aligné sur Better Auth `INVALID_PASSWORD` pour le mapping UI existant. */
export const DELETE_ACCOUNT_PASSWORD_REQUIRED_CODE = "INVALID_PASSWORD";

const DELETE_USER_PATH = "/delete-user";
const DELETE_USER_CALLBACK_PATH = "/delete-user/callback";

function normalizeAuthPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

/** POST `/delete-user` uniquement — pas le callback GET. */
export function isDeleteUserRequestPath(pathname: string): boolean {
  const normalized = normalizeAuthPath(pathname);
  return (
    normalized === DELETE_USER_PATH ||
    normalized.endsWith(`/api/auth${DELETE_USER_PATH}`) ||
    (normalized.endsWith(DELETE_USER_PATH) &&
      !normalized.endsWith(DELETE_USER_CALLBACK_PATH))
  );
}

/** GET `/delete-user/callback` (confirmation email). */
export function isDeleteUserCallbackPath(pathname: string): boolean {
  const normalized = normalizeAuthPath(pathname);
  return (
    normalized === DELETE_USER_CALLBACK_PATH ||
    normalized.endsWith(`/api/auth${DELETE_USER_CALLBACK_PATH}`) ||
    normalized.endsWith(DELETE_USER_CALLBACK_PATH)
  );
}

export function deleteAccountOpsUnavailableResponse(): Response {
  return Response.json(
    {
      message: DELETE_ACCOUNT_OPS_UNAVAILABLE_MESSAGE,
      code: "DELETE_ACCOUNT_PROVIDER_UNAVAILABLE",
    },
    { status: 503 },
  );
}

/** Prod : Resend absent / cooldown → 503 (pas de faux « email envoyé »). */
export function shouldBlockDeleteAccountBeforeAuth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return false;
  if (!resolveResendPasswordResetConfig(env)) return true;
  return isPasswordResetProviderInCooldown();
}

export async function runDeleteAccountRequestWithSendProbe(
  run: () => Promise<Response>,
): Promise<Response> {
  const probe: PasswordResetSendProbe = { failed: false };
  const response = await passwordResetSendProbe.run(probe, run);
  if (probe.failed) {
    return deleteAccountOpsUnavailableResponse();
  }
  return response;
}

export function deleteAccountPasswordRequiredResponse(): Response {
  return Response.json(
    {
      message: "Invalid password",
      code: DELETE_ACCOUNT_PASSWORD_REQUIRED_CODE,
    },
    { status: 400 },
  );
}

/** Password utilisable : string non vide après trim (espaces seuls = refus). */
export function isUsableDeleteAccountPassword(password: unknown): boolean {
  return typeof password === "string" && password.trim().length > 0;
}

function rebuildRequestWithBody(request: Request, rawBody: string): Request {
  // Body déjà lu : reconstruire une Request fraîche pour Better Auth.
  // Ne pas réutiliser `request` consommé ; conserver headers / URL / method.
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBody.length > 0 ? rawBody : undefined,
  });
}

export type PrepareDeleteUserRequestDeps = {
  request: Request;
  /** Session authentifiée uniquement — jamais un userId client. */
  getSessionUserId: (headers: Headers) => Promise<string | null>;
  hasCredentialPassword: (userId: string) => Promise<boolean>;
};

export type PrepareDeleteUserRequestResult =
  | { ok: true; request: Request }
  | { ok: false; response: Response };

/**
 * Gate serveur : compte `credential` ⇒ password obligatoire avant BA.
 * Google-only : passthrough (email de confirmation toujours exigé par BA).
 * La vérification crypto du password reste Better Auth.
 */
export async function prepareDeleteUserRequest(
  deps: PrepareDeleteUserRequestDeps,
): Promise<PrepareDeleteUserRequestResult> {
  const rawBody = await deps.request.text();
  const rebuilt = rebuildRequestWithBody(deps.request, rawBody);

  const userId = await deps.getSessionUserId(deps.request.headers);
  if (!userId) {
    // Pas de session : Better Auth refuse ; on ne déduit aucun userId.
    return { ok: true, request: rebuilt };
  }

  const requiresPassword = await deps.hasCredentialPassword(userId);
  if (!requiresPassword) {
    return { ok: true, request: rebuilt };
  }

  let password: unknown;
  try {
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    password =
      typeof parsed === "object" &&
      parsed !== null &&
      "password" in parsed
        ? (parsed as { password: unknown }).password
        : undefined;
  } catch {
    return { ok: false, response: deleteAccountPasswordRequiredResponse() };
  }

  if (!isUsableDeleteAccountPassword(password)) {
    return { ok: false, response: deleteAccountPasswordRequiredResponse() };
  }

  return { ok: true, request: rebuilt };
}

/**
 * Gate credential + sonde Resend, puis handler Better Auth.
 */
export async function runDeleteUserPostWithCredentialGate(input: {
  request: Request;
  getSessionUserId: (headers: Headers) => Promise<string | null>;
  hasCredentialPassword: (userId: string) => Promise<boolean>;
  handleAuth: (request: Request) => Promise<Response>;
}): Promise<Response> {
  const prepared = await prepareDeleteUserRequest({
    request: input.request,
    getSessionUserId: input.getSessionUserId,
    hasCredentialPassword: input.hasCredentialPassword,
  });
  if (!prepared.ok) return prepared.response;

  return runDeleteAccountRequestWithSendProbe(() =>
    input.handleAuth(prepared.request),
  );
}
