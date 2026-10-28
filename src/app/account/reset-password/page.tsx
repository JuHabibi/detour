import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AccountResetPassword } from "@/features/account/components/auth/AccountResetPassword";
import { AccountShell } from "@/features/account/components/AccountShell";
import { isPasswordResetDeliveryReady } from "@/infrastructure/email/password-reset-config";

export default function AccountResetPasswordPage() {
  // Doit rester joignable dès qu’un e-mail peut être envoyé (lien du mail).
  if (!isPasswordResetDeliveryReady()) {
    redirect("/account/login");
  }

  return (
    <AccountShell>
      <Suspense fallback={<p className="text-sm text-sand">Chargement…</p>}>
        <AccountResetPassword />
      </Suspense>
    </AccountShell>
  );
}
