import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { mapAccountOAuthError } from "@/features/account/components/auth/account-oauth-error";
import { AccountLogin } from "@/features/account/components/auth/AccountLogin";
import { AccountShell } from "@/features/account/components/AccountShell";
import { isGoogleOAuthConfigured } from "@/infrastructure/auth/google-oauth";
import { isPasswordResetPublicLinkEnabled } from "@/infrastructure/email/password-reset-config";
import { safeAccountNextPath } from "@/lib/safe-account-next-path";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

export default async function AccountLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeAccountNextPath(params.next);

  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect(nextPath);
  }

  return (
    <AccountShell>
      <AccountLogin
        nextPath={nextPath}
        showForgotPassword={isPasswordResetPublicLinkEnabled()}
        googleEnabled={isGoogleOAuthConfigured()}
        initialOAuthError={mapAccountOAuthError(params.error)}
      />
    </AccountShell>
  );
}
