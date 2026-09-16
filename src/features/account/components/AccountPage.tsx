import { Header } from "@/components/layout/Header";
import type { AccountAuthState } from "@/features/account/account-auth-state";
import { AccountSignedIn } from "@/features/account/components/AccountSignedIn";
import { AccountSignedOut } from "@/features/account/components/AccountSignedOut";
import type { GroupSummary } from "@/application/groups";
import type { EventItem } from "@/data/types";

type AccountPageProps = {
  auth: AccountAuthState;
  favorites?: EventItem[];
  groups?: GroupSummary[];
};

export function AccountPage({
  auth,
  favorites = [],
  groups = [],
}: AccountPageProps) {
  const signedIn = auth.status === "authenticated";

  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={signedIn ? favorites.length : 0}
        homeHref="/"
        accountHref="/account"
        accountLabel={signedIn ? "Mon compte" : "Se connecter"}
      />

      <main className="px-5 py-11 md:px-8 md:py-16 lg:px-12 lg:py-20 2xl:px-14 2xl:py-20 min-[1920px]:px-16">
        <div className="mx-auto min-w-0 max-w-[var(--detour-shell-max)]">
          {signedIn ? (
            <AccountSignedIn
              user={{
                name: auth.user.name,
                email: auth.user.email,
              }}
              initialFavorites={favorites}
              initialGroups={groups}
            />
          ) : (
            <AccountSignedOut />
          )}
        </div>
      </main>

      <footer className="border-t border-line px-5 py-12 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="font-display text-4xl tracking-tight">
            Détour<span className="text-coral">.</span>
          </p>
          <p className="max-w-md text-sm leading-6 text-sand">
            Compte Détour — favoris et groupes synchronisés sur vos appareils.
          </p>
        </div>
      </footer>
    </div>
  );
}
