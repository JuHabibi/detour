import { cookies } from "next/headers";
import { AccountDeleted } from "@/features/account/components/AccountDeleted";
import { resolveAccountDeletedStatus } from "@/features/account/components/auth/account-deleted-flash";
import { ACCOUNT_DELETED_FLASH_COOKIE } from "@/features/account/components/auth/account-deleted-path";
import { AccountShell } from "@/features/account/components/AccountShell";

type DeletedPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountDeletedPage({
  searchParams,
}: DeletedPageProps) {
  const params = await searchParams;
  const jar = await cookies();
  // Consommation réelle du flash : middleware (Set-Cookie maxAge=0).
  // Ici on ne lit que la requête — pas de mutation cookies en RSC.
  const status = resolveAccountDeletedStatus({
    flashValue: jar.get(ACCOUNT_DELETED_FLASH_COOKIE)?.value,
    statusParam: firstString(params.status),
    onConsume: () => undefined,
  });

  return (
    <AccountShell>
      <AccountDeleted status={status} />
    </AccountShell>
  );
}
