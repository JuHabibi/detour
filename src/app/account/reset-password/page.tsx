import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AccountResetPassword } from "@/features/account/components/AccountResetPassword";
import { AccountShell } from "@/features/account/components/AccountShell";

export default function AccountResetPasswordPage() {
  if (process.env.NODE_ENV === "production") {
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
