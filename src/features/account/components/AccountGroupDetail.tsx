"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteGroup,
  removeEventFromGroup,
  renameGroup,
} from "@/app/actions/groups";
import type { EventItem } from "@/data/types";
import { AccountFavoriteCard } from "@/features/account/components/AccountFavoriteCard";

type AccountGroupDetailProps = {
  groupId: string;
  initialName: string;
  initialEvents: EventItem[];
};

export function AccountGroupDetail({
  groupId,
  initialName,
  initialEvents,
}: AccountGroupDetailProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [draftName, setDraftName] = useState(initialName);
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const countLabel =
    events.length === 0
      ? "Aucun événement"
      : `${events.length} événement${events.length > 1 ? "s" : ""}`;

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Indiquez un nom de groupe.");
      return;
    }
    if (trimmed === name) return;

    startTransition(async () => {
      const result = await renameGroup(groupId, trimmed);
      if (!result.ok) {
        setError(
          result.reason === "not_found"
            ? "Ce groupe est introuvable."
            : result.reason === "invalid"
              ? "Indiquez un nom de groupe."
              : "Impossible de renommer. Réessayez.",
        );
        return;
      }
      setName(result.group?.name ?? trimmed);
      setDraftName(result.group?.name ?? trimmed);
      setNotice("Nom mis à jour.");
      router.refresh();
    });
  }

  function handleDelete() {
    setError(null);
    setNotice(null);
    const confirmed = window.confirm(
      `Supprimer le groupe « ${name} » ? Les événements ne seront pas effacés.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (!result.ok) {
        setError(
          result.reason === "not_found"
            ? "Ce groupe est introuvable."
            : "Impossible de supprimer. Réessayez.",
        );
        return;
      }
      router.push("/account");
      router.refresh();
    });
  }

  function handleRemoveEvent(eventId: string) {
    setError(null);
    setNotice(null);
    const previous = events;
    setEvents((current) => current.filter((item) => item.id !== eventId));

    startTransition(async () => {
      const result = await removeEventFromGroup(groupId, eventId);
      if (result.ok) {
        router.refresh();
        return;
      }
      setEvents(previous);
      setError(
        result.reason === "not_found"
          ? "Impossible de retirer cet événement."
          : "Impossible de retirer cet événement. Réessayez.",
      );
    });
  }

  return (
    <div>
      <Link
        href="/account"
        className="text-[12px] font-medium uppercase tracking-[0.12em] text-sand transition-colors hover:text-ink"
      >
        ← Mon compte
      </Link>

      <div className="mt-6 flex flex-col gap-6 md:mt-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
            Groupe
          </p>
          <h1 className="mt-3 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:text-[2.5rem]">
            {name}
          </h1>
          <p className="mt-3 text-[12px] uppercase tracking-[0.12em] text-sand">
            {countLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="self-start text-[12px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:text-coral disabled:opacity-60 md:self-end"
        >
          Supprimer le groupe
        </button>
      </div>

      <form
        onSubmit={handleRename}
        className="mt-8 flex flex-col gap-3 border-b border-line pb-8 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
            Renommer
          </span>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={80}
            className="w-full border border-line bg-foam px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center border border-line px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink disabled:opacity-60"
        >
          Enregistrer
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm text-sand" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {events.length === 0 ? (
        <p className="mt-10 text-sm leading-6 text-cream-dim">
          Ce groupe est vide. Ajoutez des favoris depuis Mon compte.
        </p>
      ) : (
        <div className="mt-8">
          {events.map((event) => (
            <AccountFavoriteCard
              key={event.id}
              event={event}
              onRemove={handleRemoveEvent}
              removeLabel="Retirer du groupe"
            />
          ))}
        </div>
      )}
    </div>
  );
}
