import { redirect } from "next/navigation";
import { AccountSignup } from "@/features/account/components/AccountSignup";
import { AccountShell } from "@/features/account/components/AccountShell";
import { getAccountAuthState } from "@/infrastructure/auth/get-account-auth-state";

export default async function AccountSignupPage() {
  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect("/account");
  }

  return (
    <AccountShell accountLabel="Créer un compte">
      <AccountSignup />
    </AccountShell>
  );
}
