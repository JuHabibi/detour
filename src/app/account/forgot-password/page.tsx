import { redirect } from "next/navigation";
import { AccountForgotPassword } from "@/features/account/components/AccountForgotPassword";
import { AccountShell } from "@/features/account/components/AccountShell";

export default function AccountForgotPasswordPage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/account/login");
  }

  return (
    <AccountShell>
      <AccountForgotPassword />
    </AccountShell>
  );
}
