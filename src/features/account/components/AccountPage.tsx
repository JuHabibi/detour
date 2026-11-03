import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import type { AccountAuthState } from "@/features/account/account-auth-state";
import { AccountSignedIn } from "@/features/account/components/AccountSignedIn";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import type { EventItem } from "@/data/types";

type AccountPageProps = {
  auth: Extract<AccountAuthState, { status: "authenticated" }>;
  favorites?: EventItem[];
  groups?: GroupSummary[];
  memberships?: EventGroupMembership[];
  requiresPasswordForDelete?: boolean;
};

export function AccountPage({
  auth,
  favorites = [],
  groups = [],
  memberships = [],
  requiresPasswordForDelete = false,
}: AccountPageProps) {
  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={favorites.length}
        homeHref="/"
        user={{ name: auth.user.name, email: auth.user.email }}
        showFriseNav
      />
      <PendingFavoriteAfterAuthGate enabled />

      <main className="px-5 py-11 md:px-8 md:py-16 lg:px-12 lg:py-20 2xl:px-14 2xl:py-20 min-[1920px]:px-16">
        <div className="mx-auto min-w-0 max-w-[var(--detour-shell-max)]">
          <AccountSignedIn
            initialFavorites={favorites}
            initialGroups={groups}
            initialMemberships={memberships}
            requiresPasswordForDelete={requiresPasswordForDelete}
          />
        </div>
      </main>

      <footer className="border-t border-line px-5 py-12 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="font-display text-4xl tracking-tight">
            Détour<span className="text-coral">.</span>
          </p>
          <p className="max-w-md text-sm leading-6 text-sand">
            Compte Détour — favoris, carnets, export calendrier (.ics) et mon
            parcours culturel.
          </p>
        </div>
      </footer>
    </div>
  );
}
