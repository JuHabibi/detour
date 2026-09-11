"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { AccountPrototypeState } from "@/features/account/mock/account-prototype-state";

const STATES: { state: AccountPrototypeState; label: string }[] = [
  { state: "signed-out", label: "Déconnecté" },
  { state: "login", label: "Connexion" },
  { state: "signup", label: "Création" },
  { state: "signed-in", label: "Avec favoris" },
  { state: "empty", label: "Sans favori" },
];

type AccountPrototypeNavProps = {
  current: AccountPrototypeState;
};

/** Barre de revue — bascule d’états mock, hors produit. */
export function AccountPrototypeNav({ current }: AccountPrototypeNavProps) {
  return (
    <div className="border-b border-line bg-ink-3/60">
      <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
          Prototype Account
        </p>
        <nav aria-label="États de maquette" className="flex flex-wrap gap-1.5">
          {STATES.map(({ state, label }) => {
            const active = state === current;
            return (
              <Link
                key={state}
                href={`/account?state=${state}`}
                className={cn(
                  "px-2.5 py-1 text-[12px] transition-colors",
                  active
                    ? "bg-ink text-foam"
                    : "bg-foam text-sand hover:text-ink",
                )}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
