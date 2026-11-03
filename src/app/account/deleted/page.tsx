import { AccountDeleted } from "@/features/account/components/AccountDeleted";
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
  const statusParam = firstString(params.status);
  const status = statusParam === "invalid" ? "invalid" : "success";

  return (
    <AccountShell>
      <AccountDeleted status={status} />
    </AccountShell>
  );
}
