import { AccountPage } from "@/features/account/components/AccountPage";
import { resolveAccountPrototypeState } from "@/features/account/mock/account-prototype-state";

type AccountRoutePageProps = {
  searchParams: Promise<{ state?: string }>;
};

export default async function AccountRoutePage({
  searchParams,
}: AccountRoutePageProps) {
  const params = await searchParams;
  const state = resolveAccountPrototypeState(params.state);

  return <AccountPage state={state} />;
}
