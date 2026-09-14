import { AccountForgotPassword } from "@/features/account/components/AccountForgotPassword";
import { AccountShell } from "@/features/account/components/AccountShell";

export default function AccountForgotPasswordPage() {
  return (
    <AccountShell accountLabel="Se connecter">
      <AccountForgotPassword />
    </AccountShell>
  );
}
