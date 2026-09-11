"use client";

import { Header } from "@/components/layout/Header";
import { AccountLogin } from "@/features/account/components/AccountLogin";
import { AccountPrototypeNav } from "@/features/account/components/AccountPrototypeNav";
import { AccountSignedIn } from "@/features/account/components/AccountSignedIn";
import { AccountSignedOut } from "@/features/account/components/AccountSignedOut";
import { AccountSignup } from "@/features/account/components/AccountSignup";
import {
  MOCK_ACCOUNT_USER,
  MOCK_FAVORITE_EVENTS,
} from "@/features/account/mock/account-mock";
import type { AccountPrototypeState } from "@/features/account/mock/account-prototype-state";

type AccountPageProps = {
  state: AccountPrototypeState;
};

export function AccountPage({ state }: AccountPageProps) {
  const signedIn = state === "signed-in" || state === "empty";

  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={state === "signed-in" ? MOCK_FAVORITE_EVENTS.length : 0}
        homeHref="/"
        accountHref={
          signedIn ? "/account?state=signed-in" : "/account?state=login"
        }
        accountLabel={signedIn ? "Mon compte" : "Se connecter"}
      />
      <AccountPrototypeNav current={state} />

      <main className="px-5 py-11 md:px-8 md:py-16 lg:px-12 lg:py-20 2xl:px-14 2xl:py-20 min-[1920px]:px-16">
        <div className="mx-auto min-w-0 max-w-[var(--detour-shell-max)]">
          {state === "signed-out" ? (
            <AccountSignedOut onSignInHref="/account?state=login" />
          ) : null}
          {state === "login" ? <AccountLogin /> : null}
          {state === "signup" ? <AccountSignup /> : null}
          {state === "signed-in" || state === "empty" ? (
            <AccountSignedIn
              key={state}
              user={MOCK_ACCOUNT_USER}
              initialFavorites={
                state === "empty" ? [] : MOCK_FAVORITE_EVENTS
              }
            />
          ) : null}
        </div>
      </main>

      <footer className="border-t border-line px-5 py-12 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="font-display text-4xl tracking-tight">
            Détour<span className="text-coral">.</span>
          </p>
          <p className="max-w-md text-sm leading-6 text-sand">
            Maquette Account V1 — aucune authentification, aucune donnée
            persistée.
          </p>
        </div>
      </footer>
    </div>
  );
}
