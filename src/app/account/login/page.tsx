import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { AccountLogin } from "@/features/account/components/AccountLogin";
import { AccountShell } from "@/features/account/components/AccountShell";
import { safeAccountNextPath } from "@/features/account/safe-account-next-path";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function AccountLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeAccountNextPath(params.next);

  const auth = await getAccountAuthState();
  if (auth.status === "authenticated") {
    redirect(nextPath);
  }

  return (
    <AccountShell>
      <AccountLogin nextPath={nextPath} />
    </AccountShell>
  );
}
