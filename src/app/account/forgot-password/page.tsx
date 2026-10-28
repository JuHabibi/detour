import { redirect } from "next/navigation";
import { AccountForgotPassword } from "@/features/account/components/auth/AccountForgotPassword";
import { AccountShell } from "@/features/account/components/AccountShell";
import { isPasswordResetDeliveryReady } from "@/infrastructure/email/password-reset-config";

export default function AccountForgotPasswordPage() {
  // Accessible dès que Resend est prêt (test contrôlé via URL, sans lien login).
  if (!isPasswordResetDeliveryReady()) {
    redirect("/account/login");
  }

  return (
    <AccountShell>
      <AccountForgotPassword />
    </AccountShell>
  );
}
