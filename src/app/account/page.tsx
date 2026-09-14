import { AccountPage } from "@/features/account/components/AccountPage";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";

export default async function AccountRoutePage() {
  const auth = await getAccountAuthState();
  return <AccountPage auth={auth} />;
}
