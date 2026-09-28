import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { AccountSignup } from "@/features/account/components/AccountSignup";
import { AccountShell } from "@/features/account/components/AccountShell";
import { safeAccountNextPath } from "@/features/account/auth/safe-account-next-path";

type SignupPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
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
      <AccountSignup nextPath={nextPath} />
    </AccountShell>
  );
}
