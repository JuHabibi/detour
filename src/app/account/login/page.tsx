import { redirect } from "next/navigation";
import { AccountLogin } from "@/features/account/components/AccountLogin";
import { AccountShell } from "@/features/account/components/AccountShell";
import { getAccountAuthState } from "@/infrastructure/auth/get-account-auth-state";

export default async function AccountLoginPage() {
  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect("/account");
  }

  return (
    <AccountShell accountLabel="Se connecter">
      <AccountLogin />
    </AccountShell>
  );
}
