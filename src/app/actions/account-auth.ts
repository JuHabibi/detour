"use server";

import { headers } from "next/headers";
import { auth } from "@/infrastructure/auth/auth";

export type AccountAuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

const SIGNUP_ERROR =
  "Impossible de créer le compte. Vérifiez vos informations ou réessayez.";
const LOGIN_ERROR =
  "Impossible de se connecter. Vérifiez votre email et votre mot de passe.";
const RESET_REQUEST_ERROR =
  "Impossible d’envoyer la demande pour le moment. Réessayez plus tard.";
const RESET_REQUEST_UNAVAILABLE =
  "La réinitialisation par email n’est pas encore disponible.";
const RESET_PASSWORD_ERROR =
  "Impossible de réinitialiser le mot de passe. Réessayez.";

export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AccountAuthActionResult> {
  try {
    await auth.api.signUpEmail({
      body: {
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: SIGNUP_ERROR };
  }
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AccountAuthActionResult> {
  try {
    await auth.api.signInEmail({
      body: {
        email: input.email.trim(),
        password: input.password,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: LOGIN_ERROR };
  }
}

export async function signOutAccount(): Promise<AccountAuthActionResult> {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Impossible de se déconnecter. Réessayez." };
  }
}

export async function requestPasswordReset(input: {
  email: string;
  redirectTo: string;
}): Promise<AccountAuthActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: RESET_REQUEST_UNAVAILABLE };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: input.email.trim(),
        redirectTo: input.redirectTo,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: RESET_REQUEST_ERROR };
  }
}

export async function resetPasswordWithToken(input: {
  token: string;
  newPassword: string;
}): Promise<AccountAuthActionResult> {
  try {
    await auth.api.resetPassword({
      body: {
        token: input.token,
        newPassword: input.newPassword,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: RESET_PASSWORD_ERROR };
  }
}
