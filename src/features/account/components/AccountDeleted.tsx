import Link from "next/link";
import { AccountAuthLayout } from "@/features/account/components/auth/AccountAuthLayout";
import { DELETE_ACCOUNT_INVALID_LINK } from "@/features/account/components/auth/account-delete-feedback";

type AccountDeletedProps = {
  status?: "success" | "invalid";
};

export function AccountDeleted({ status = "success" }: AccountDeletedProps) {
  const isInvalid = status === "invalid";

  return (
    <AccountAuthLayout variant="login">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Compte
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        {isInvalid ? "Lien invalide." : "Compte supprimé."}
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
        {isInvalid
          ? DELETE_ACCOUNT_INVALID_LINK
          : "Votre compte Détour et vos données personnelles associées ont été définitivement effacés. Les événements culturels publics restent disponibles."}
      </p>
      <p className="mt-10 md:mt-12">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
        >
          Retour à l’accueil
        </Link>
      </p>
    </AccountAuthLayout>
  );
}
