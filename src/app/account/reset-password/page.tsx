import { Suspense } from "react";
import { AccountResetPassword } from "@/features/account/components/AccountResetPassword";
import { AccountShell } from "@/features/account/components/AccountShell";

export default function AccountResetPasswordPage() {
  return (
    <AccountShell accountLabel="Se connecter">
      <Suspense fallback={<p className="text-sm text-sand">Chargement…</p>}>
        <AccountResetPassword />
      </Suspense>
    </AccountShell>
  );
}
