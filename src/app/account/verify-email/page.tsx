import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { AccountVerifyEmail } from "@/features/account/components/auth/AccountVerifyEmail";
import { mapVerifyEmailCallbackError } from "@/features/account/components/auth/account-email-verification-feedback";
import { AccountShell } from "@/features/account/components/AccountShell";
import { safeAccountNextPath } from "@/lib/safe-account-next-path";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    email?: string | string[];
    error?: string | string[];
    confirmed?: string | string[];
  }>;
};

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountVerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const nextPath = safeAccountNextPath(params.next);
  const email = firstString(params.email)?.trim() ?? "";
  const confirmed = firstString(params.confirmed) === "1";
  const callbackError = mapVerifyEmailCallbackError(params.error);

  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect(nextPath);
  }

  return (
    <AccountShell>
      <AccountVerifyEmail
        nextPath={nextPath}
        initialEmail={email}
        initialError={callbackError}
        confirmed={confirmed && !callbackError}
      />
    </AccountShell>
  );
}
