import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { AccountSignup } from "@/features/account/components/AccountSignup";
import { AccountShell } from "@/features/account/components/AccountShell";

export default async function AccountSignupPage() {
  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect("/account");
  }

  return (
    <AccountShell>
      <AccountSignup />
    </AccountShell>
  );
}
