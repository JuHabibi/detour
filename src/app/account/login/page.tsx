import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { AccountLogin } from "@/features/account/components/AccountLogin";
import { AccountShell } from "@/features/account/components/AccountShell";

export default async function AccountLoginPage() {
  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect("/account");
  }

  return (
    <AccountShell>
      <AccountLogin />
    </AccountShell>
  );
}
