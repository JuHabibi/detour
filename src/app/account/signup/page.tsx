import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { mapAccountOAuthError } from "@/features/account/components/auth/account-oauth-error";
import { AccountSignup } from "@/features/account/components/auth/AccountSignup";
import { AccountShell } from "@/features/account/components/AccountShell";
import { isGoogleOAuthConfigured } from "@/infrastructure/auth/google-oauth";
import { safeAccountNextPath } from "@/lib/safe-account-next-path";

type SignupPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

export default async function AccountSignupPage({
  searchParams,
}: SignupPageProps) {
  const params = await searchParams;
  const nextPath = safeAccountNextPath(params.next);

  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect(nextPath);
  }

  return (
    <AccountShell>
      <AccountSignup
        nextPath={nextPath}
        googleEnabled={isGoogleOAuthConfigured()}
        initialOAuthError={mapAccountOAuthError(params.error)}
      />
    </AccountShell>
  );
}
