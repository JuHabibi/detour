import { AccountDangerZone } from "@/features/account/components/AccountDangerZone";

type AccountSettingsProps = {
  name: string;
  email: string;
  requiresPasswordForDelete: boolean;
};

/**
 * Identité en lecture seule + zone sensible (suppression).
 * Pas de formulaire d’édition — page paramètres minimale.
 */
export function AccountSettings({
  name,
  email,
  requiresPasswordForDelete,
}: AccountSettingsProps) {
  const displayName = name.trim() || email.trim() || "Compte";

  return (
    <div className="max-w-xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Compte
      </p>
      <h1 className="mt-3 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-4 md:text-[2.75rem] lg:text-[3rem]">
        Paramètres.
      </h1>
      <p className="mt-4 text-sm leading-6 text-cream-dim md:mt-5">
        Informations de votre compte Détour.
      </p>

      <dl className="mt-10 space-y-6 md:mt-12">
        <div>
          <dt className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
            Nom
          </dt>
          <dd className="mt-2 text-sm leading-6 text-ink">{displayName}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
            Email
          </dt>
          <dd className="mt-2 break-all text-sm leading-6 text-ink">{email}</dd>
        </div>
      </dl>

      <AccountDangerZone requiresPassword={requiresPasswordForDelete} />
    </div>
  );
}
