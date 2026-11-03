import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { AccountSettings } from "@/features/account/components/AccountSettings";
import { AccountShell } from "@/features/account/components/AccountShell";
import { getPool } from "@/infrastructure/db/postgres";
import { listFavoriteEventsForUser } from "@/infrastructure/db/favorite.repository";
import { userHasCredentialPassword } from "@/infrastructure/db/user-has-credential-password";
import { accountLoginHref } from "@/lib/safe-account-next-path";

export default async function AccountSettingsPage() {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    redirect(accountLoginHref("/account/settings"));
  }

  const [requiresPasswordForDelete, favoriteCount] = await Promise.all([
    userHasCredentialPassword(getPool(), auth.user.id),
    listFavoriteEventsForUser(auth.user.id).then((rows) => rows.length),
  ]);

  return (
    <AccountShell
      user={{ name: auth.user.name, email: auth.user.email }}
      showFriseNav
      favoriteCount={favoriteCount}
    >
      <AccountSettings
        name={auth.user.name}
        email={auth.user.email}
        requiresPasswordForDelete={requiresPasswordForDelete}
      />
    </AccountShell>
  );
}
