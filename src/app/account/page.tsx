import { AccountPage } from "@/features/account/components/AccountPage";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  listEventGroupMembershipsForUser,
  listGroupSummariesForUser,
} from "@/application/groups";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { listFavoriteEventsForUser } from "@/infrastructure/db/favorite.repository";

export default async function AccountRoutePage() {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return <AccountPage auth={auth} />;
  }

  const [favorites, groups, memberships] = await Promise.all([
    listFavoriteEventsForUser(auth.user.id).then((rows) =>
      rows.map(mapDetourEventToEventItem),
    ),
    listGroupSummariesForUser(auth.user.id),
    listEventGroupMembershipsForUser(auth.user.id),
  ]);

  return (
    <AccountPage
      auth={auth}
      favorites={favorites}
      groups={groups}
      memberships={memberships}
    />
  );
}
