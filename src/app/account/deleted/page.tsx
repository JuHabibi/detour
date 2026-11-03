import { cookies } from "next/headers";
import {
  AccountDeleted,
  type AccountDeletedStatus,
} from "@/features/account/components/AccountDeleted";
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

/**
 * Succès = flash httpOnly posé par le wrapper après BA (pas `?status=success`).
 * `?status=invalid` = échec callback (jeton / session).
 */
async function resolveDeletedStatus(
  statusParam: string | undefined,
): Promise<AccountDeletedStatus> {
  const jar = await cookies();
  if (jar.get(ACCOUNT_DELETED_FLASH_COOKIE)?.value === "1") {
    return "success";
  }
  if (statusParam === "invalid") return "invalid";
  return "unknown";
}

export default async function AccountDeletedPage({
  searchParams,
}: DeletedPageProps) {
  const params = await searchParams;
  const status = await resolveDeletedStatus(firstString(params.status));

  return (
    <AccountShell>
      <AccountDeleted status={status} />
    </AccountShell>
  );
}
