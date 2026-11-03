import { redirect } from "next/navigation";
import { AccountPage } from "@/features/account/components/AccountPage";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  listEventGroupMembershipsForUser,
  listGroupSummariesForUser,
} from "@/application/groups";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { getPool } from "@/infrastructure/db/postgres";
import { listFavoriteEventsForUser } from "@/infrastructure/db/favorite.repository";
import { userHasCredentialPassword } from "@/infrastructure/db/user-has-credential-password";
import { accountLoginHref } from "@/lib/safe-account-next-path";

export default async function AccountRoutePage() {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    redirect(accountLoginHref("/account"));
  }

  const [favorites, groups, memberships, requiresPasswordForDelete] =
    await Promise.all([
      listFavoriteEventsForUser(auth.user.id).then((rows) =>
        rows.map(mapDetourEventToEventItem),
      ),
      listGroupSummariesForUser(auth.user.id),
      listEventGroupMembershipsForUser(auth.user.id),
      userHasCredentialPassword(getPool(), auth.user.id),
    ]);

  return (
    <AccountPage
      auth={auth}
      favorites={favorites}
      groups={groups}
      memberships={memberships}
      requiresPasswordForDelete={requiresPasswordForDelete}
    />
  );
}
