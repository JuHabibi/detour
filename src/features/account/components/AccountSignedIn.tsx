"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFavorite } from "@/app/actions/favorites";
import type { EventItem } from "@/data/types";
import { authClient } from "@/features/account/auth-client";
import { AccountAddToAgendaModal } from "@/features/account/components/AccountAddToAgendaModal";
import { AccountEmptyFavorites } from "@/features/account/components/AccountEmptyFavorites";
import { AccountFavoriteCard } from "@/features/account/components/AccountFavoriteCard";

export type AccountUserView = {
  name: string;
  email: string;
};

type AccountSignedInProps = {
  user: AccountUserView;
  initialFavorites?: EventItem[];
};

export function AccountSignedIn({
  user,
  initialFavorites = [],
}: AccountSignedInProps) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(initialFavorites);
  const [agendaEvent, setAgendaEvent] = useState<EventItem | null>(null);
  const [agendaNotice, setAgendaNotice] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const countLabel = useMemo(() => {
    const n = favorites.length;
    if (n === 0) return "Aucun favori";
    return `${n} favori${n > 1 ? "s" : ""}`;
  }, [favorites.length]);

  function handleRemove(id: string) {
    setRemoveError(null);
    const previous = favorites;
    setFavorites((current) => current.filter((event) => event.id !== id));
    setAgendaNotice(null);
    if (agendaEvent?.id === id) setAgendaEvent(null);

    startTransition(async () => {
      const result = await removeFavorite(id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setFavorites(previous);
      setRemoveError("Impossible de retirer ce favori. Réessayez.");
    });
  }

  function handleOpenAgenda(id: string) {
    const event = favorites.find((item) => item.id === id) ?? null;
    setAgendaEvent(event);
    setAgendaNotice(null);
  }

  function handleConfirmAgenda() {
    if (!agendaEvent) return;
    setAgendaNotice(
      `Maquette — « ${agendaEvent.title} » : fichier .ics non généré.`,
    );
    setAgendaEvent(null);
  }

  async function handleLogout() {
    setLogoutPending(true);
    setLogoutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setLogoutError("Impossible de se déconnecter. Réessayez.");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setLogoutError("Impossible de se déconnecter. Réessayez.");
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
            Mon compte
          </p>
          <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
            Vos détours
          </h1>
          <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
            Les sorties que vous gardez sous la main — à retrouver ici, ou à
            glisser dans votre agenda.
          </p>
        </div>

        <div className="shrink-0 md:pb-1 md:text-right">
          <p className="font-display text-lg tracking-tight text-ink">
            {user.name}
          </p>
          <p className="mt-1 text-[12px] text-sand">{user.email}</p>
          <p className="mt-3 text-[12px] uppercase tracking-[0.12em] text-sand">
            {countLabel}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutPending}
            className="mt-4 text-[12px] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
          >
            {logoutPending ? "Déconnexion…" : "Se déconnecter"}
          </button>
          {logoutError ? (
            <p className="mt-2 text-sm text-coral" role="alert">
              {logoutError}
            </p>
          ) : null}
        </div>
      </div>

      {removeError ? (
        <p className="mt-6 text-sm text-coral" role="alert">
          {removeError}
        </p>
      ) : null}

      {favorites.length === 0 ? (
        <div className="mt-10 md:mt-14">
          <AccountEmptyFavorites />
        </div>
      ) : (
        <div className="mt-10 md:mt-14">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
            <h2 className="font-display text-[1.35rem] tracking-tight text-ink md:text-[1.5rem]">
              Favoris
            </h2>
            <p className="text-[12px] uppercase tracking-[0.12em] text-sand">
              {countLabel}
            </p>
          </div>

          <div>
            {favorites.map((event) => (
              <AccountFavoriteCard
                key={event.id}
                event={event}
                onRemove={handleRemove}
                onAddToAgenda={handleOpenAgenda}
              />
            ))}
          </div>

          {agendaNotice ? (
            <p
              className="mt-6 text-sm text-sand"
              role="status"
              aria-live="polite"
            >
              {agendaNotice}
            </p>
          ) : null}
        </div>
      )}

      {agendaEvent ? (
        <AccountAddToAgendaModal
          event={agendaEvent}
          onClose={() => setAgendaEvent(null)}
          onConfirm={handleConfirmAgenda}
        />
      ) : null}
    </div>
  );
}
