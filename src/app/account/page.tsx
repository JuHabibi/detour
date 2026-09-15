import { AccountPage } from "@/features/account/components/AccountPage";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { listFavoriteEventsForUser } from "@/infrastructure/db/favorite.repository";

export default async function AccountRoutePage() {
  const auth = await getAccountAuthState();
  const favorites =
    auth.status === "authenticated"
      ? (await listFavoriteEventsForUser(auth.user.id)).map(
          mapDetourEventToEventItem,
        )
      : [];

  return <AccountPage auth={auth} favorites={favorites} />;
}
