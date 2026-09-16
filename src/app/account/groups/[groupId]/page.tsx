import { notFound, redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getGroupWithEventsForUser } from "@/application/groups";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { AccountGroupDetail } from "@/features/account/components/AccountGroupDetail";
import { AccountShell } from "@/features/account/components/AccountShell";

type GroupPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function AccountGroupRoutePage({ params }: GroupPageProps) {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    redirect("/account/login");
  }

  const { groupId } = await params;
  const group = await getGroupWithEventsForUser(auth.user.id, groupId);
  if (!group) notFound();

  const events = group.events.map(mapDetourEventToEventItem);

  return (
    <AccountShell accountLabel="Mon compte">
      <AccountGroupDetail
        groupId={group.id}
        initialName={group.name}
        initialEvents={events}
      />
    </AccountShell>
  );
}
